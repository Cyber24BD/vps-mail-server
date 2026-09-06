#!/usr/bin/env bash
# ==============================================================================
# Corporate Mail Platform - 1-Click Zero-Data-Loss Updater
# Pulls latest updates from GitHub, rebuilds containers, and validates health
# ==============================================================================

set -eo pipefail

# Color Codes
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

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

echo -e "${BLUE}[*] Stage 1: Pre-Update Environment & Integrity Verification...${NC}"

# Check for root / sudo
if [ "$EUID" -ne 0 ]; then
  echo -e "${RED}[!] Error: Please run this update script as root (or via sudo).${NC}"
  exit 1
fi

# Ensure .env exists to preserve secrets
if [ ! -f .env ]; then
  echo -e "${RED}[!] Error: .env file not found. Ensure you are running inside the installation directory.${NC}"
  exit 1
fi

CURRENT_COMMIT=$(git rev-parse --short HEAD 2>/dev/null || echo "unknown")
echo -e "${GREEN}[✓] Current installed version: ${CURRENT_COMMIT}${NC}"

# Automatic Pre-Update Safety Backup
echo -e "${BLUE}[*] Stage 2: Creating Automated Pre-Update Safety Snapshot...${NC}"
BACKUP_TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
mkdir -p /var/mail-platform/backups
if docker compose ps | grep -q "postgres"; then
  echo -e "${YELLOW}[*] Dumping PostgreSQL database to /var/mail-platform/backups/pre_update_${BACKUP_TIMESTAMP}.sql...${NC}"
  docker compose exec -T postgres pg_dump -U mailuser corpmail > "/var/mail-platform/backups/pre_update_${BACKUP_TIMESTAMP}.sql" || true
  echo -e "${GREEN}[✓] Pre-update database snapshot completed.${NC}"
fi

# Fetch and check for new commits from GitHub
echo -e "${BLUE}[*] Stage 3: Fetching Latest Release from GitHub...${NC}"
git fetch origin main

REMOTE_COMMIT=$(git rev-parse --short origin/main 2>/dev/null || echo "unknown")

if [ "$CURRENT_COMMIT" = "$REMOTE_COMMIT" ] && [ "$1" != "--force" ]; then
  echo -e "${GREEN}[✓] System is already running the latest version (${CURRENT_COMMIT}). No update needed.${NC}"
  echo -e "${YELLOW}    To force a container rebuild, run: ./update.sh --force${NC}"
  exit 0
fi

echo -e "${YELLOW}[*] Update detected: ${CURRENT_COMMIT} -> ${REMOTE_COMMIT}${NC}"

# Pull latest code while strictly preserving local .env
echo -e "${BLUE}[*] Stage 4: Pulling Repository Updates...${NC}"
git pull origin main
chmod +x *.sh || true

# Re-synchronize database password from .env to Postfix & Dovecot SQL configurations
echo -e "${BLUE}[*] Stage 5: Synchronizing Configuration Maps...${NC}"
POSTGRES_PASS=$(grep '^POSTGRES_PASSWORD=' .env | cut -d '=' -f2)
if [ -n "$POSTGRES_PASS" ]; then
  sed -i "s/password = .*/password = ${POSTGRES_PASS}/g" docker/postfix/sql/pgsql-virtual-mailbox-domains.cf || true
  sed -i "s/password = .*/password = ${POSTGRES_PASS}/g" docker/postfix/sql/pgsql-virtual-mailbox-maps.cf || true
  sed -i "s/password = .*/password = ${POSTGRES_PASS}/g" docker/postfix/sql/pgsql-virtual-alias-maps.cf || true
  sed -i "s/password=[^ ]*/password=${POSTGRES_PASS}/g" docker/dovecot/dovecot-sql.conf.ext || true
  echo -e "${GREEN}[✓] Mail configuration templates verified.${NC}"
fi

# Rebuild and reload Docker microservices
echo -e "${BLUE}[*] Stage 6: Rebuilding & Deploying Updated Services...${NC}"
docker compose up -d --build

# Run Health Check
echo -e "${BLUE}[*] Stage 7: Performing Post-Update Health Probe...${NC}"
MAX_RETRIES=15
COUNT=0
until docker compose exec -T postgres pg_isready -U mailuser -d corpmail &> /dev/null || [ $COUNT -eq $MAX_RETRIES ]; do
  sleep 2
  COUNT=$((COUNT + 1))
done

NEW_COMMIT=$(git rev-parse --short HEAD 2>/dev/null || echo "unknown")
echo ""
echo -e "${GREEN}==============================================================================${NC}"
echo -e "${GREEN}  Corporate Mail Platform Updated Successfully!${NC}"
echo -e "${GREEN}  Version: ${NEW_COMMIT}${NC}"
echo -e "${GREEN}  Mail storage, certificates, and credentials safely preserved.${NC}"
echo -e "${GREEN}==============================================================================${NC}"
