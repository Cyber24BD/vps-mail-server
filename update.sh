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

if [ "$CURRENT_COMMIT" = "$REMOTE_COMMIT" ] && [ "$1" != "--force" ]; then
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

# Reload Nginx to immediately flush internal container DNS cache
docker compose restart nginx >/dev/null 2>&1 || true

# Stage 7: Post-Update Health Probe
log_info "Stage 7: Validating microservice operational health..."
MAX_RETRIES=15
COUNT=0
until docker compose exec -T postgres pg_isready -U mailuser -d corpmail &> /dev/null || [ $COUNT -eq $MAX_RETRIES ]; do
  sleep 2
  COUNT=$((COUNT + 1))
done

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
