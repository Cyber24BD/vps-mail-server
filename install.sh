#!/usr/bin/env bash
# ==============================================================================
# Corporate Mail Platform - Master Modular Installer
# Automated preflight, container verification, and production bootstrapping
# ==============================================================================

set -eo pipefail

# Load Modular Script Libraries
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "${SCRIPT_DIR}/scripts/colors.sh"
source "${SCRIPT_DIR}/scripts/preflight.sh"
source "${SCRIPT_DIR}/scripts/docker_check.sh"
source "${SCRIPT_DIR}/scripts/storage_setup.sh"
source "${SCRIPT_DIR}/scripts/config_sync.sh"
source "${SCRIPT_DIR}/scripts/admin_setup.sh"

# Global Error Trap Handler
trap_error() {
  local exit_code=$?
  local line_number=$1
  log_error "Installation failed at line ${line_number} (Exit Code: ${exit_code})."
  log_hint "View detailed container logs with: 'docker compose logs -f'"
  log_hint "You can safely retry after fixing any issues by running: 'sudo ./install.sh'"
  exit "${exit_code}"
}
trap 'trap_error ${LINENO}' ERR

# Welcome Banner
echo -e "${CYAN}"
cat << "EOF"
  ____                               _         __  __       _ _ 
 / ___|___  _ __ _ __   ___  _ __ __ _| |_ ___  |  \/  | __ _(_) |
| |   / _ \| '__| '_ \ / _ \| '__/ _` | __/ _ \ | |\/| |/ _` | | |
| |__| (_) | |  | |_) | (_) | | | (_| | ||  __/ | |  | | (_| | | |
 \____\___/|_|  | .__/ \___/|_|  \__,_|\__\___| |_|  |_|\__,_|_|_|
                |_|                                                
       Enterprise Self-Hosted Corporate Mail Infrastructure
EOF
echo -e "${NC}"

# Stage 1: Preflight Checks
log_info "Stage 1: Running Preflight Checks & Resource Inspection..."
check_root
check_os
check_resources
check_mail_ports
assign_control_port
detect_public_ip
check_outbound_smtp

# Stage 2: Container Engine Verification
log_info "Stage 2: Verifying Container Engine (Docker & Compose)..."
ensure_docker_installed

# Stage 3: Storage & Vmail Permissions
log_info "Stage 3: Preparing Host Storage & Vmail User Structure..."
init_storage_and_permissions
init_bootstrap_ssl

# Stage 4: Environment & Mail Config Synchronization
log_info "Stage 4: Initializing Credentials & Configuration Maps..."
init_env_file
sync_sql_maps
configure_ufw

# Stage 5: Deploy Containers
log_info "Stage 5: Starting Mail Infrastructure Containers via Docker..."
docker compose down --remove-orphans >/dev/null 2>&1 || true
docker compose up -d --build

# Stage 6: Database Readiness Probe
log_info "Stage 6: Awaiting PostgreSQL Database Readiness..."
MAX_RETRIES=20
COUNT=0
until docker compose exec -T postgres pg_isready -U mailuser -d corpmail &> /dev/null || [ $COUNT -eq $MAX_RETRIES ]; do
  sleep 2
  COUNT=$((COUNT + 1))
done

if [ $COUNT -eq $MAX_RETRIES ]; then
  log_action_needed "PostgreSQL database failed to report ready within 40 seconds." \
    "Inspect database logs with: 'docker compose logs postgres'"
  exit 1
fi
log_success "PostgreSQL is online and accepting connections."

# Stage 7: Super Administrator Provisioning
log_info "Stage 7: Configuring Super Administrator Account..."
setup_super_admin

# Final Success Banner
echo ""
echo -e "${GREEN}==============================================================================${NC}"
echo -e "${GREEN}  Corporate Mail Platform Installed Successfully!${NC}"
echo -e "${GREEN}==============================================================================${NC}"
echo ""

echo -e "${CYAN}📌 Access URLs:${NC}"
echo -e "  • Admin Control Panel:  ${YELLOW}http://${PUBLIC_IP}:${CHOSEN_CONTROL_PORT}${NC}  (or http://${PUBLIC_IP})"
echo -e "  • Webmail / Mail Login: ${YELLOW}http://${PUBLIC_IP}:${CHOSEN_CONTROL_PORT}${NC}  (or https://mail.<yourdomain> once SSL is issued)"
echo ""

if [ "$ADMIN_CREATED_IN_CLI" = true ]; then
  echo -e "${CYAN}🔑 Super Administrator Credentials:${NC}"
  echo -e "  • Username: ${YELLOW}${ADMIN_CLI_USER}${NC}"
  echo -e "  • Password: ${YELLOW}[The password you set during installation]${NC}"
  echo ""
  echo -e "${CYAN}🚀 Immediate Next Steps:${NC}"
  echo -e "  1. Open ${YELLOW}http://${PUBLIC_IP}:${CHOSEN_CONTROL_PORT}${NC} in your browser and sign in"
  echo -e "  2. Go to 'Domains' tab -> Click 'Add Domain' (e.g. toamun.com)"
  echo -e "  3. Set up the generated DNS records (MX, SPF, DKIM 2048-bit, DMARC)"
  echo -e "  4. Go to 'Mailboxes' tab -> Add team accounts (e.g. it@toamun.com, manager@toamun.com)"
else
  echo -e "${CYAN}🔑 First-Time Setup Wizard:${NC}"
  echo -e "  • Open: ${YELLOW}http://${PUBLIC_IP}:${CHOSEN_CONTROL_PORT}${NC}"
  echo -e "  • The Setup Wizard will guide you to create your Super Admin account in Step 4."
  echo ""
  echo -e "${CYAN}🚀 Next Steps in Setup Wizard:${NC}"
  echo -e "  1. Automated Server & IP Verification"
  echo -e "  2. Connect your Primary Corporate Mail Domain (e.g. toamun.com)"
  echo -e "  3. Review Generated DNS Records (MX, SPF, DKIM 2048-bit, DMARC)"
  echo -e "  4. Create your Super Administrator Account & Launch Dashboard"
fi

echo ""
echo -e "${CYAN}📱 Mail Client Connection Endpoints (Outlook / Thunderbird / Mobile):${NC}"
echo -e "  • Incoming IMAP: ${YELLOW}mail.<yourdomain>${NC} (Port 993 SSL / Port 143 STARTTLS)"
echo -e "  • Outgoing SMTP: ${YELLOW}mail.<yourdomain>${NC} (Port 465 SSL / Port 587 STARTTLS)"
echo ""
echo -e "${CYAN}⚙️ Management Commands:${NC}"
echo -e "  • 1-Click Update:   ${YELLOW}sudo ./update.sh${NC}"
echo -e "  • View Live Logs:   ${YELLOW}docker compose logs -f${NC}"
echo -e "  • Restart Services: ${YELLOW}docker compose restart${NC}"
echo -e "${GREEN}==============================================================================${NC}"
