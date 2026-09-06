#!/usr/bin/env bash
# ==============================================================================
# Environment Credentials & Postfix/Dovecot SQL Synchronizer
# ==============================================================================

init_env_file() {
  if [ ! -f .env ]; then
    log_info "Generating secure credentials and environment configuration..."
    local secret_key=$(openssl rand -hex 32)
    local pg_pass=$(openssl rand -base64 16 | tr -dc 'a-zA-Z0-9' | fold -w 16 | head -n 1)
    local redis_pass=$(openssl rand -base64 16 | tr -dc 'a-zA-Z0-9' | fold -w 16 | head -n 1)
    local rspamd_pass=$(openssl rand -base64 16 | tr -dc 'a-zA-Z0-9' | fold -w 16 | head -n 1)

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

SECRET_KEY=${secret_key}
JWT_ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=1440

POSTGRES_SERVER=postgres
POSTGRES_PORT=5432
POSTGRES_USER=mailuser
POSTGRES_PASSWORD=${pg_pass}
POSTGRES_DB=corpmail

REDIS_HOST=redis
REDIS_PORT=6379
REDIS_PASSWORD=${redis_pass}

PRIMARY_HOSTNAME=mail.bootstrap.local
VMAIL_UID=5000
VMAIL_GID=5000
DEFAULT_QUOTA_MB=5120

RSPAMD_PASSWORD=${rspamd_pass}
CLAMAV_ENABLED=true

DATA_DIR=/var/mail-platform/data
MAIL_DIR=/var/mail-platform/vmail
DKIM_DIR=/var/mail-platform/dkim
SSL_DIR=/var/mail-platform/ssl
BACKUP_DIR=/var/mail-platform/backups
LOG_DIR=/var/mail-platform/logs
ENV_CONFIG

    POSTGRES_PASS=${pg_pass}
    log_success "Generated cryptographically secure passwords in .env."
  else
    POSTGRES_PASS=$(grep '^POSTGRES_PASSWORD=' .env | cut -d '=' -f2)
    CHOSEN_CONTROL_PORT=$(grep '^CONTROL_PORT=' .env | cut -d '=' -f2 || echo "7080")
    log_info "Existing .env file detected. Reusing existing credentials."
  fi
}

sync_sql_maps() {
  log_info "Synchronizing PostgreSQL credentials to Postfix & Dovecot SQL configurations..."
  sed -i "s/password = .*/password = ${POSTGRES_PASS}/g" docker/postfix/sql/pgsql-virtual-mailbox-domains.cf 2>/dev/null || true
  sed -i "s/password = .*/password = ${POSTGRES_PASS}/g" docker/postfix/sql/pgsql-virtual-mailbox-maps.cf 2>/dev/null || true
  sed -i "s/password = .*/password = ${POSTGRES_PASS}/g" docker/postfix/sql/pgsql-virtual-alias-maps.cf 2>/dev/null || true
  sed -i "s/password=[^ ]*/password=${POSTGRES_PASS}/g" docker/dovecot/dovecot-sql.conf.ext 2>/dev/null || true
  log_success "Database credentials successfully mapped to mail engine configs."
}

configure_ufw() {
  if command -v ufw &> /dev/null && ufw status | grep -q "Status: active"; then
    log_info "Active UFW firewall detected. Enabling required mail, web, and remote management ports..."
    ufw allow 22/tcp comment "SSH Server (Safety Rule)" >/dev/null 2>&1 || true
    ufw allow 25/tcp comment "SMTP Gateway" >/dev/null 2>&1 || true
    ufw allow 80/tcp comment "HTTP / ACME" >/dev/null 2>&1 || true
    ufw allow 443/tcp comment "HTTPS Webmail" >/dev/null 2>&1 || true
    ufw allow 465/tcp comment "SMTPS Secure Submission" >/dev/null 2>&1 || true
    ufw allow 587/tcp comment "SMTP Submission" >/dev/null 2>&1 || true
    ufw allow 143/tcp comment "IMAP STARTTLS" >/dev/null 2>&1 || true
    ufw allow 993/tcp comment "IMAPS Secure" >/dev/null 2>&1 || true
    ufw allow "${CHOSEN_CONTROL_PORT}/tcp" comment "Bootstrap Control Panel" >/dev/null 2>&1 || true
    log_success "UFW rules applied (Ports 22, 25, 80, 143, 443, 465, 587, 993, ${CHOSEN_CONTROL_PORT})."
  fi
}
