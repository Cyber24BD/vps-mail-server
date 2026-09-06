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

# Final Success Banner
echo ""
echo -e "${GREEN}==============================================================================${NC}"
echo -e "${GREEN}  Corporate Mail Platform Installed Successfully!${NC}"
echo -e "${GREEN}==============================================================================${NC}"
echo ""
echo -e "Access your Control Panel in ${YELLOW}Bootstrap Mode${NC} to run the First-Time Setup Wizard:"
echo ""
echo -e "  🌐 ${CYAN}http://${PUBLIC_IP}:${CHOSEN_CONTROL_PORT}${NC}"
echo ""
echo -e "Available Next Steps in the Setup Wizard:"
echo -e "  1. Connect your Primary Corporate Mail Domain (e.g. company.com)"
echo -e "  2. Review Generated DNS Records (MX, SPF, DKIM 2048-bit, DMARC, PTR)"
echo -e "  3. Issue Free Let's Encrypt SSL Certificate with 1-Click"
echo -e "  4. Create Employee Mailboxes & Access Custom Webmail"
echo ""
echo -e "Management Commands:"
echo -e "  • 1-Click Update:   ${YELLOW}sudo ./update.sh${NC}"
echo -e "  • View Live Logs:   ${YELLOW}docker compose logs -f${NC}"
echo -e "  • Restart Services: ${YELLOW}docker compose restart${NC}"
echo -e "${GREEN}==============================================================================${NC}"
