#!/usr/bin/env bash
# ==============================================================================
# Corporate Mail Platform - One-Step Production Installer
# Tested on Ubuntu 20.04 / 22.04 / 24.04 LTS & Debian 11 / 12
# ==============================================================================

set -eo pipefail

# Color Codes for Terminal Output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

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

echo -e "${BLUE}[*] Stage 1: Validating Environment & Host Specifications...${NC}"

# Check for root privileges
if [ "$EUID" -ne 0 ]; then
  echo -e "${RED}[!] Error: This installation script must be run as root (or via sudo).${NC}"
  exit 1
fi

# Detect OS
if [ -f /etc/os-release ]; then
  . /etc/os-release
  OS=$ID
  OS_VERSION=$VERSION_ID
  echo -e "${GREEN}[✓] Detected OS: $PRETTY_NAME${NC}"
else
  echo -e "${RED}[!] Error: Unsupported Linux distribution.${NC}"
  exit 1
fi

if [[ "$OS" != "ubuntu" && "$OS" != "debian" ]]; then
  echo -e "${YELLOW}[!] Warning: Recommended distributions are Ubuntu or Debian. Proceeding anyway...${NC}"
fi

# Check Architecture
ARCH=$(uname -m)
if [[ "$ARCH" != "x86_64" && "$ARCH" != "aarch64" ]]; then
  echo -e "${RED}[!] Error: Architecture $ARCH is not supported. Required: x86_64 or aarch64.${NC}"
  exit 1
fi
echo -e "${GREEN}[✓] CPU Architecture: $ARCH${NC}"

# Check Memory (RAM)
TOTAL_RAM=$(free -m | awk '/^Mem:/{print $2}')
if [ "$TOTAL_RAM" -lt 1900 ]; then
  echo -e "${YELLOW}[!] Warning: Detected ${TOTAL_RAM}MB RAM. Mail scanning (ClamAV & Rspamd) recommends at least 2048MB - 4096MB RAM.${NC}"
else
  echo -e "${GREEN}[✓] Memory check passed: ${TOTAL_RAM}MB RAM available.${NC}"
fi

# Check Available Disk Space
AVAIL_DISK_KB=$(df -P / | awk 'NR==2 {print $4}')
AVAIL_DISK_GB=$((AVAIL_DISK_KB / 1024 / 1024))
if [ "$AVAIL_DISK_GB" -lt 10 ]; then
  echo -e "${RED}[!] Error: At least 10GB free disk space required. Detected: ${AVAIL_DISK_GB}GB.${NC}"
  exit 1
fi
echo -e "${GREEN}[✓] Storage check passed: ${AVAIL_DISK_GB}GB free space on root filesystem.${NC}"

# Dynamic Port Verification & Non-Conflicting Control Port Assignment
echo -e "${BLUE}[*] Stage 2: Checking Mail Ports & Assigning Control Port...${NC}"
MAIL_PORTS=(25 80 443 587 993)
CONFLICT=0

for PORT in "${MAIL_PORTS[@]}"; do
  if ss -tuln | grep -q ":${PORT} "; then
    echo -e "${RED}[!] Standard mail/web port $PORT is already in use by another process!${NC}"
    CONFLICT=1
  else
    echo -e "${GREEN}[✓] Mail port $PORT is free.${NC}"
  fi
done

if [ "$CONFLICT" -eq 1 ]; then
  echo -e "${RED}[!] Error: Please stop existing mail (e.g. exim4/sendmail/postfix) or web server (apache2/nginx) before running.${NC}"
  echo -e "${YELLOW}    Tip: Run 'systemctl stop postfix exim4 apache2' and retry.${NC}"
  exit 1
fi

# Detect or assign CONTROL_PORT (Default: 7080, fallback to 7081, 7082 if busy)
CHOSEN_CONTROL_PORT=7080
while ss -tuln | grep -q ":${CHOSEN_CONTROL_PORT} "; do
  echo -e "${YELLOW}[!] Control port ${CHOSEN_CONTROL_PORT} is in use, checking next port...${NC}"
  CHOSEN_CONTROL_PORT=$((CHOSEN_CONTROL_PORT + 1))
done
echo -e "${GREEN}[✓] Assigned Control Panel Port: ${CHOSEN_CONTROL_PORT}${NC}"

# Detect Public IP
PUBLIC_IP=$(curl -s -4 https://ifconfig.me || curl -s -4 https://api.ipify.org || echo "127.0.0.1")
echo -e "${GREEN}[✓] Detected Public IP: ${PUBLIC_IP}${NC}"

# Check and Install Docker & Docker Compose
echo -e "${BLUE}[*] Stage 3: Checking Container Engine (Docker)...${NC}"
if ! command -v docker &> /dev/null; then
  echo -e "${YELLOW}[*] Docker not found. Installing Docker engine automatically...${NC}"
  apt-get update -y
  apt-get install -y ca-certificates curl gnupg lsb-release
  mkdir -p /etc/apt/keyrings
  curl -fsSL https://download.docker.com/linux/$OS/gpg | gpg --dearmor -o /etc/apt/keyrings/docker.gpg
  echo \
    "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/$OS \
    $(lsb_release -cs) stable" | tee /etc/apt/sources.list.d/docker.list > /dev/null
  apt-get update -y
  apt-get install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin
  systemctl enable docker
  systemctl start docker
  echo -e "${GREEN}[✓] Docker installed successfully.${NC}"
else
  echo -e "${GREEN}[✓] Docker is already installed: $(docker --version)${NC}"
fi

# Create Storage Directories on Host with Proper Permissions
echo -e "${BLUE}[*] Stage 4: Preparing Host Storage Directories...${NC}"
mkdir -p /var/mail-platform/vmail
mkdir -p /var/mail-platform/dkim
mkdir -p /var/mail-platform/ssl
mkdir -p /var/mail-platform/backups
mkdir -p /var/mail-platform/logs

# Create vmail user and group (UID 5000: GID 5000) for Dovecot
if ! getent group vmail > /dev/null 2>&1; then
  groupadd -g 5000 vmail
fi
if ! getent passwd vmail > /dev/null 2>&1; then
  useradd -r -u 5000 -g vmail -d /var/mail-platform/vmail -s /sbin/nologin -c "Virtual Mail User" vmail
fi

chown -R 5000:5000 /var/mail-platform/vmail
chmod -R 770 /var/mail-platform/vmail
chmod 700 /var/mail-platform/dkim
echo -e "${GREEN}[✓] Storage directories initialized with UID:GID 5000.${NC}"

# Generate Temporary Self-Signed SSL Certificate for Bootstrap Mode
echo -e "${BLUE}[*] Stage 5: Preparing Bootstrap SSL Certificates...${NC}"
if [ ! -f /var/mail-platform/ssl/privkey.pem ]; then
  openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
    -keyout /var/mail-platform/ssl/privkey.pem \
    -out /var/mail-platform/ssl/fullchain.pem \
    -subj "/C=US/ST=State/L=City/O=CorporateMail/OU=IT/CN=${PUBLIC_IP}" > /dev/null 2>&1
  chmod 600 /var/mail-platform/ssl/privkey.pem
  echo -e "${GREEN}[✓] Bootstrap SSL certificates generated.${NC}"
fi

# Generate .env configuration file if missing
echo -e "${BLUE}[*] Stage 6: Initializing Security Credentials & Environment...${NC}"
if [ ! -f .env ]; then
  SECRET_KEY=$(openssl rand -hex 32)
  POSTGRES_PASS=$(openssl rand -base64 16 | tr -dc 'a-zA-Z0-9' | fold -w 16 | head -n 1)
  REDIS_PASS=$(openssl rand -base64 16 | tr -dc 'a-zA-Z0-9' | fold -w 16 | head -n 1)
  RSPAMD_PASS=$(openssl rand -base64 16 | tr -dc 'a-zA-Z0-9' | fold -w 16 | head -n 1)

  cat << ENV_CONFIG > .env
ENVIRONMENT=production
NODE_ENV=production
DEBUG=false
TZ=UTC

SERVER_IP=${PUBLIC_IP}
CONTROL_PORT=${CHOSEN_CONTROL_PORT}
HTTP_PORT=80
HTTPS_PORT=443

ENABLE_WEBMAIL=true
ENABLE_CLAMAV=true
ENABLE_RSPAMD=true
ENABLE_FAIL2BAN=true
ENABLE_BACKUPS=true
ENABLE_ALIASES=true
ENABLE_DIAGNOSTICS=true

SECRET_KEY=${SECRET_KEY}
JWT_ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=1440

POSTGRES_SERVER=postgres
POSTGRES_PORT=5432
POSTGRES_USER=mailuser
POSTGRES_PASSWORD=${POSTGRES_PASS}
POSTGRES_DB=corpmail

REDIS_HOST=redis
REDIS_PORT=6379
REDIS_PASSWORD=${REDIS_PASS}

PRIMARY_HOSTNAME=mail.bootstrap.local
VMAIL_UID=5000
VMAIL_GID=5000
DEFAULT_QUOTA_MB=5120

RSPAMD_PASSWORD=${RSPAMD_PASS}
CLAMAV_ENABLED=true

DATA_DIR=/var/mail-platform/data
MAIL_DIR=/var/mail-platform/vmail
DKIM_DIR=/var/mail-platform/dkim
SSL_DIR=/var/mail-platform/ssl
BACKUP_DIR=/var/mail-platform/backups
LOG_DIR=/var/mail-platform/logs
ENV_CONFIG

  echo -e "${GREEN}[✓] Generated unique security keys and stored in .env.${NC}"
else
  # Read existing database password and control port from .env
  POSTGRES_PASS=$(grep '^POSTGRES_PASSWORD=' .env | cut -d '=' -f2)
  CHOSEN_CONTROL_PORT=$(grep '^CONTROL_PORT=' .env | cut -d '=' -f2 || echo "7080")
  echo -e "${YELLOW}[i] Existing .env file detected. Keeping current credentials.${NC}"
fi

# Synchronize Database Credentials to Postfix and Dovecot SQL Maps
echo -e "${BLUE}[*] Stage 7: Synchronizing PostgreSQL Credentials to Mail Services...${NC}"
sed -i "s/password = .*/password = ${POSTGRES_PASS}/g" docker/postfix/sql/pgsql-virtual-mailbox-domains.cf || true
sed -i "s/password = .*/password = ${POSTGRES_PASS}/g" docker/postfix/sql/pgsql-virtual-mailbox-maps.cf || true
sed -i "s/password = .*/password = ${POSTGRES_PASS}/g" docker/postfix/sql/pgsql-virtual-alias-maps.cf || true
sed -i "s/password=[^ ]*/password=${POSTGRES_PASS}/g" docker/dovecot/dovecot-sql.conf.ext || true
echo -e "${GREEN}[✓] Postfix & Dovecot SQL configurations synchronized with database password.${NC}"

# Configure UFW Firewall rules if UFW is active
if command -v ufw &> /dev/null && ufw status | grep -q "Status: active"; then
  echo -e "${BLUE}[*] Configuring UFW firewall rules...${NC}"
  ufw allow 25/tcp comment "SMTP Mail"
  ufw allow 80/tcp comment "HTTP / ACME"
  ufw allow 443/tcp comment "HTTPS Webmail"
  ufw allow 587/tcp comment "SMTP Submission"
  ufw allow 993/tcp comment "IMAPS Secure"
  ufw allow ${CHOSEN_CONTROL_PORT}/tcp comment "Bootstrap Control Panel"
  echo -e "${GREEN}[✓] UFW firewall configured.${NC}"
fi

# Start Services via Docker Compose
echo -e "${BLUE}[*] Stage 8: Deploying Infrastructure Services via Docker...${NC}"
docker compose down --remove-orphans || true
docker compose up -d --build

echo -e "${BLUE}[*] Stage 9: Performing Health Check & Database Synchronization...${NC}"
# Wait for PostgreSQL to become healthy
MAX_RETRIES=20
COUNT=0
until docker compose exec -T postgres pg_isready -U mailuser -d corpmail &> /dev/null || [ $COUNT -eq $MAX_RETRIES ]; do
  sleep 2
  COUNT=$((COUNT + 1))
done

if [ $COUNT -eq $MAX_RETRIES ]; then
  echo -e "${RED}[!] Database startup timed out. Check logs with 'docker compose logs postgres'.${NC}"
  exit 1
fi
echo -e "${GREEN}[✓] PostgreSQL database is healthy and accepting connections.${NC}"

# Final Banner & Next Steps
echo ""
echo -e "${GREEN}==============================================================================${NC}"
echo -e "${GREEN}  Corporate Mail Platform Installed Successfully!${NC}"
echo -e "${GREEN}==============================================================================${NC}"
echo ""
echo -e "Access your Control Panel in ${YELLOW}Bootstrap Mode${NC} to run the First-Time Setup Wizard:"
echo ""
echo -e "  🌐 ${CYAN}http://${PUBLIC_IP}:${CHOSEN_CONTROL_PORT}${NC} (or http://localhost:${CHOSEN_CONTROL_PORT})"
echo ""
echo -e "Features Available in Bootstrap Mode:"
echo -e "  1. Create Primary Super Administrator"
echo -e "  2. Connect Corporate Mail Domain"
echo -e "  3. Automatic DNS Records Detection & Verification (MX, SPF, DKIM, DMARC, PTR)"
echo -e "  4. Automated One-Click SSL Issuance via Let's Encrypt"
echo -e "  5. Create Employee Mailboxes & Access Custom Webmail"
echo ""
echo -e "To view live system logs:       ${YELLOW}docker compose logs -f${NC}"
echo -e "To restart mail platform:       ${YELLOW}docker compose restart${NC}"
echo -e "=============================================================================="
