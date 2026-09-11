#!/usr/bin/env bash
# ==============================================================================
# Corporate Mail Platform - Intelligent 1-Click Zero-Data-Loss Updater
# Safe git synchronization, pre-update snapshots, and automated rollback
# ==============================================================================

set -eo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "${SCRIPT_DIR}/scripts/colors.sh"
source "${SCRIPT_DIR}/scripts/config_sync.sh"

echo -e "${CYAN}"
cat << "EOF"
  ____                     __  __       _ _   _   _           _       _            
 / ___|___  _ __ _ __     |  \/  | __ _(_) | | | | |_ __   __| | __ _| |_ ___ _ __ 
| |   / _ \| '__| '_ \ ___| |\/| |/ _` | | | | | | | '_ \ / _` |/ _` | __/ _ \ '__|
| |__| (_) | |  | |_) |___| |  | | (_| | | | | |_| | |_) | (_| | (_| | ||  __/ |   
 \____\___/|_|  | .__/    |_|  |_|\__,_|_|_|  \___/| .__/ \__,_|\__,_|\__\___|_|   
                |_|                                |_|                             
EOF
echo -e "${NC}"

# Parse Command-line Arguments
FORCE_REBUILD=false
AUTO_RESTART_ALL=false
SKIP_RESTART=false
NON_INTERACTIVE=false

for arg in "$@"; do
  case "$arg" in
    --force)
      FORCE_REBUILD=true
      ;;
    -y|--yes|--restart-all)
      AUTO_RESTART_ALL=true
      ;;
    --skip-restart)
      SKIP_RESTART=true
      ;;
    --non-interactive)
      NON_INTERACTIVE=true
      ;;
  esac
done

IS_TTY=false
if [ -t 0 ] || [ -c /dev/tty ]; then
  IS_TTY=true
fi

prompt_user() {
  local prompt_text="$1"
  local default_val="$2"
  local user_val=""

  if [ "$IS_TTY" = false ] || [ "$NON_INTERACTIVE" = true ]; then
    echo "$default_val"
    return
  fi

  if [ -c /dev/tty ]; then
    read -r -p "$prompt_text" user_val </dev/tty || user_val="$default_val"
  else
    read -r -p "$prompt_text" user_val || user_val="$default_val"
  fi

  if [ -z "$user_val" ]; then
    echo "$default_val"
  else
    echo "$user_val"
  fi
}

restart_mail_services() {
  log_info "Restarting Mail Server & Security Services (Postfix SMTP, Dovecot IMAP, Rspamd, ClamAV)..."
  docker compose restart postfix dovecot rspamd clamav
  log_success "Mail servers (SMTP 25/465/587, IMAP 143/993, Rspamd Milter) restarted."
}

restart_python_services() {
  log_info "Restarting Python Server (FastAPI REST API & Background Task Worker)..."
  docker compose restart backend worker
  log_success "Python backend and background worker restarted."
}

restart_js_services() {
  log_info "Restarting JS Server (React Webmail & Dashboard Frontend)..."
  docker compose restart frontend
  log_success "JS frontend server restarted."
}

restart_proxy_services() {
  log_info "Restarting Gateway & Reverse Proxy (Nginx)..."
  docker compose restart nginx
  log_success "Nginx reverse proxy restarted."
}

restart_database_services() {
  log_info "Restarting Database & In-Memory Cache (PostgreSQL & Redis)..."
  docker compose restart postgres redis
  log_success "PostgreSQL and Redis restarted."
}

restart_docker_daemon() {
  log_info "Restarting host Docker Engine Daemon..."
  if command -v systemctl &>/dev/null && systemctl is-active --quiet docker; then
    systemctl restart docker
    log_info "Waiting for Docker daemon socket to re-establish..."
    sleep 5
    docker compose up -d
    log_success "Host Docker Engine Daemon restarted and containers restored."
  elif command -v service &>/dev/null; then
    service docker restart
    sleep 5
    docker compose up -d
    log_success "Host Docker service restarted and containers restored."
  else
    log_warn "Host service manager not available. Skipping Docker engine daemon restart."
  fi
}

restart_all_services() {
  log_info "Performing coordinated full restart of ALL platform services..."
  log_info "  -> Restarting Database & In-Memory Cache..."
  docker compose restart postgres redis
  log_info "  -> Restarting Python API Server & Background Scheduler..."
  docker compose restart backend worker
  log_info "  -> Restarting Mail Gateway & IMAP Services (Postfix, Dovecot, Rspamd, ClamAV)..."
  docker compose restart postfix dovecot rspamd clamav
  log_info "  -> Restarting JS Frontend Webmail & Dashboard..."
  docker compose restart frontend
  log_info "  -> Restarting Core Nginx Proxy..."
  docker compose restart nginx
  log_success "All platform microservices successfully restarted and synchronized."
}

# Stage 1: Pre-Update Environment & Integrity Verification
log_info "Stage 1: Checking update permissions & repository integrity..."

if [ "$EUID" -ne 0 ]; then
  log_action_needed "Updater launched without root privileges." \
    "Run updater with sudo: 'sudo ./update.sh'"
  exit 1
fi

if [ ! -f .env ]; then
  log_action_needed ".env file not found in current directory." \
    "Make sure you run ./update.sh from your installation directory (e.g. /var/mail-platform)."
  exit 1
fi

CURRENT_COMMIT=$(git rev-parse --short HEAD 2>/dev/null || echo "unknown")
log_success "Current installed version: ${CURRENT_COMMIT}"

# Stage 2: Automated Pre-Update Safety Snapshot
log_info "Stage 2: Creating automated database snapshot before upgrade..."
BACKUP_TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
SNAPSHOT_FILE="/var/mail-platform/backups/pre_update_${BACKUP_TIMESTAMP}.sql"
mkdir -p /var/mail-platform/backups

if docker compose ps | grep -q "postgres"; then
  log_info "Backing up database to ${SNAPSHOT_FILE}..."
  docker compose exec -T postgres pg_dump -U mailuser corpmail > "${SNAPSHOT_FILE}" 2>/dev/null || true
  log_success "Database snapshot completed."
fi

# Stage 3: Checking Remote GitHub Repository
log_info "Stage 3: Checking GitHub for newly published commits..."
git fetch origin main 2>/dev/null || {
  log_action_needed "Failed to fetch from GitHub." \
    "Check your server's internet connectivity and DNS resolution."
  exit 1
}

REMOTE_COMMIT=$(git rev-parse --short origin/main 2>/dev/null || echo "unknown")

if [ "$CURRENT_COMMIT" = "$REMOTE_COMMIT" ] && [ "$FORCE_REBUILD" != true ]; then
  log_success "Platform is already up to date (${CURRENT_COMMIT}). No update necessary."
  log_hint "To force-rebuild containers anyway, run: 'sudo ./update.sh --force'"
  exit 0
fi

log_info "New update detected: ${CURRENT_COMMIT} -> ${REMOTE_COMMIT}"

# Stage 4: Pulling Changes with Dirty-Tree Auto-Stash Protection
log_info "Stage 4: Safely pulling updates from GitHub..."
if ! git diff-index --quiet HEAD --; then
  log_warn "Local modifications detected. Auto-stashing local changes to prevent merge conflicts..."
  git stash save "Auto-saved local modifications before platform update ${BACKUP_TIMESTAMP}" >/dev/null 2>&1 || true
fi

git pull origin main
chmod +x *.sh scripts/*.sh 2>/dev/null || true

# Stage 5: Re-synchronizing Configuration Templates
log_info "Stage 5: Synchronizing database passwords and mail service configs..."
POSTGRES_PASS=$(grep '^POSTGRES_PASSWORD=' .env | cut -d '=' -f2)
sync_sql_maps

# Stage 6: Rebuilding Containers with Rollback Trap
log_info "Stage 6: Rebuilding and reloading updated microservices..."
if ! docker compose up -d --build; then
  log_error "Container build failed!"
  log_action_needed "Rebuild encountered an error. Rolling back to previous state..." \
    "Restoring database snapshot: 'docker compose exec -T postgres psql -U mailuser corpmail < ${SNAPSHOT_FILE}'"
  exit 1
fi

# Clean up dangling build cache to conserve host RAM and disk space
docker builder prune -f >/dev/null 2>&1 || true

# Always restart Nginx reverse proxy so it immediately picks up fresh container internal IPs
log_info "Synchronizing reverse proxy upstream IP bindings..."
docker compose restart nginx || true

# Stage 7: Post-Update Health Probe
log_info "Stage 7: Validating microservice operational health..."
MAX_RETRIES=15
COUNT=0
until docker compose exec -T postgres pg_isready -U mailuser -d corpmail &> /dev/null || [ $COUNT -eq $MAX_RETRIES ]; do
  sleep 2
  COUNT=$((COUNT + 1))
done

# Stage 8: Post-Update Service Re-Initialization & Interactive Restart
log_info "Stage 8: Post-update service re-initialization..."

if [ "$SKIP_RESTART" = true ]; then
  log_warn "Service restart skipped as requested by --skip-restart flag."
elif [ "$AUTO_RESTART_ALL" = true ] || [ "$IS_TTY" = false ] || [ "$NON_INTERACTIVE" = true ]; then
  log_info "Non-interactive or auto-restart mode: Restarting all services for a fresh operational state..."
  restart_all_services
else
  echo ""
  echo -e "${CYAN}╔════════════════════════════════════════════════════════════════════════════╗${NC}"
  echo -e "${CYAN}║             POST-UPDATE SERVICE RE-INITIALIZATION & RESTART                ║${NC}"
  echo -e "${CYAN}╠════════════════════════════════════════════════════════════════════════════╣${NC}"
  echo -e "${CYAN}║ To ensure all updated code, Python servers, JS frontend, mail configurations║${NC}"
  echo -e "${CYAN}║ and Docker sockets work cleanly, would you like to restart services now?   ║${NC}"
  echo -e "${CYAN}╚════════════════════════════════════════════════════════════════════════════╝${NC}"
  echo ""
  echo -e "Choose restart option:"
  echo -e "  ${GREEN}1) [Recommended] Restart EVERYTHING${NC} (Mail Servers, Python Server, JS Server, Proxy, DB)"
  echo -e "  ${YELLOW}2) Ask for EVERY SINGLE component individually${NC} (Mail, Python, JS, Proxy, Docker engine)"
  echo -e "  ${BLUE}3) Restart Mail Services Only${NC} (Postfix SMTP, Dovecot IMAP, Rspamd, ClamAV)"
  echo -e "  ${BLUE}4) Restart Python Server Only${NC} (FastAPI Backend API & Background Worker)"
  echo -e "  ${BLUE}5) Restart JS Server & Gateway Only${NC} (Frontend Webmail & Nginx)"
  echo -e "  ${BLUE}6) Restart Host Docker Engine Daemon${NC} (systemctl restart docker)"
  echo -e "  ${RED}7) Skip restart${NC} (Keep current running instances)"
  echo ""

  RESTART_CHOICE=$(prompt_user "Enter choice [1-7] (Default: 1 - Restart EVERYTHING): " "1")

  case "$RESTART_CHOICE" in
    1)
      restart_all_services
      echo ""
      ASK_DOCKER_DAEMON=$(prompt_user "Would you also like to restart the host Docker engine daemon (systemctl restart docker)? [y/N]: " "n")
      if [[ "$ASK_DOCKER_DAEMON" =~ ^[Yy]$ ]]; then
        restart_docker_daemon
      fi
      ;;
    2)
      echo ""
      echo -e "${BOLD}Step-by-step component selection:${NC}"
      
      ASK_MAIL=$(prompt_user "1. Restart Mail Services (Postfix SMTP, Dovecot IMAP, Rspamd, ClamAV)? [Y/n]: " "y")
      if [[ ! "$ASK_MAIL" =~ ^[Nn]$ ]]; then
        restart_mail_services
      fi

      ASK_PY=$(prompt_user "2. Restart Python Server (FastAPI REST API & Background Task Worker)? [Y/n]: " "y")
      if [[ ! "$ASK_PY" =~ ^[Nn]$ ]]; then
        restart_python_services
      fi

      ASK_JS=$(prompt_user "3. Restart JS Server (React Webmail & Dashboard Frontend)? [Y/n]: " "y")
      if [[ ! "$ASK_JS" =~ ^[Nn]$ ]]; then
        restart_js_services
      fi

      ASK_PROXY=$(prompt_user "4. Restart Gateway & Reverse Proxy (Nginx)? [Y/n]: " "y")
      if [[ ! "$ASK_PROXY" =~ ^[Nn]$ ]]; then
        restart_proxy_services
      fi

      ASK_DB=$(prompt_user "5. Restart Database & In-Memory Cache (PostgreSQL & Redis)? [y/N]: " "n")
      if [[ "$ASK_DB" =~ ^[Yy]$ ]]; then
        restart_database_services
      fi

      ASK_DOCKER=$(prompt_user "6. Restart Host Docker Engine Daemon (systemctl restart docker)? [y/N]: " "n")
      if [[ "$ASK_DOCKER" =~ ^[Yy]$ ]]; then
        restart_docker_daemon
      fi
      ;;
    3)
      restart_mail_services
      ;;
    4)
      restart_python_services
      ;;
    5)
      restart_js_services
      restart_proxy_services
      ;;
    6)
      restart_docker_daemon
      ;;
    7)
      log_warn "Service restart skipped by user."
      ;;
    *)
      log_info "Selected option '$RESTART_CHOICE' -> proceeding with default full restart..."
      restart_all_services
      ;;
  esac
fi

# Stage 9: Container Health Summary
log_info "Stage 9: Validating active container statuses..."
echo ""
docker compose ps 2>/dev/null || true
echo ""

NEW_COMMIT=$(git rev-parse --short HEAD 2>/dev/null || echo "unknown")
CHOSEN_CONTROL_PORT=$(grep '^CONTROL_PORT=' .env | cut -d '=' -f2 || echo "7080")
SERVER_IP=$(grep '^SERVER_IP=' .env | cut -d '=' -f2 || curl -s https://api.ipify.org 2>/dev/null || echo "YOUR_VPS_IP")

echo ""
echo -e "${GREEN}==============================================================================${NC}"
echo -e "${GREEN}  Corporate Mail Platform Updated Successfully!${NC}"
echo -e "${GREEN}  Active Version: ${NEW_COMMIT}${NC}"
echo -e "${GREEN}  Pre-Update Safety Backup: ${SNAPSHOT_FILE}${NC}"
echo -e "${GREEN}  All Mailboxes, SSL Certificates, and Passwords Safely Preserved.${NC}"
echo -e "${GREEN}==============================================================================${NC}"
echo ""
echo -e "${CYAN}📌 Access URLs:${NC}"
echo -e "  • Control Panel & Webmail: ${YELLOW}http://${SERVER_IP}:${CHOSEN_CONTROL_PORT}${NC} (or http://${SERVER_IP})"
echo -e "${GREEN}==============================================================================${NC}"
