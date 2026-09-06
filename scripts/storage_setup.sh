#!/usr/bin/env bash
# ==============================================================================
# Storage Directories, Vmail Permissions & Bootstrap SSL Generator
# ==============================================================================

init_storage_and_permissions() {
  log_info "Initializing host storage directories and user permissions..."

  mkdir -p /var/mail-platform/vmail
  mkdir -p /var/mail-platform/dkim
  mkdir -p /var/mail-platform/ssl
  mkdir -p /var/mail-platform/backups
  mkdir -p /var/mail-platform/logs

  # Ensure vmail group and user exist (UID 5000: GID 5000) for Dovecot
  if ! getent group vmail > /dev/null 2>&1; then
    groupadd -g 5000 vmail
  fi
  if ! getent passwd vmail > /dev/null 2>&1; then
    useradd -r -u 5000 -g vmail -d /var/mail-platform/vmail -s /sbin/nologin -c "Virtual Mail User" vmail
  fi

  chown -R 5000:5000 /var/mail-platform/vmail
  chmod -R 770 /var/mail-platform/vmail
  chmod 700 /var/mail-platform/dkim
  log_success "Storage directories configured with vmail (UID:GID 5000)."
}

init_bootstrap_ssl() {
  log_info "Verifying bootstrap TLS certificates..."
  if [ ! -f /var/mail-platform/ssl/privkey.pem ]; then
    openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
      -keyout /var/mail-platform/ssl/privkey.pem \
      -out /var/mail-platform/ssl/fullchain.pem \
      -subj "/C=US/ST=State/L=City/O=CorporateMail/OU=IT/CN=${PUBLIC_IP}" > /dev/null 2>&1
    chmod 600 /var/mail-platform/ssl/privkey.pem
    log_success "Temporary self-signed certificate generated for bootstrap mode."
  else
    log_success "Existing SSL certificate detected."
  fi
}
