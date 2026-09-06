#!/bin/sh
set -e

# Dynamically sync PostgreSQL credentials from environment
if [ -n "$POSTGRES_PASSWORD" ]; then
  sed -i "s/password=[^ ]*/password=${POSTGRES_PASSWORD}/g" /etc/dovecot/dovecot-sql.conf.ext 2>/dev/null || true
fi
if [ -n "$POSTGRES_USER" ]; then
  sed -i "s/user=[^ ]*/user=${POSTGRES_USER}/g" /etc/dovecot/dovecot-sql.conf.ext 2>/dev/null || true
fi
if [ -n "$POSTGRES_DB" ]; then
  sed -i "s/dbname=[^ ]*/dbname=${POSTGRES_DB}/g" /etc/dovecot/dovecot-sql.conf.ext 2>/dev/null || true
fi

# Ensure proper ownership and permissions for Dovecot configs
chown -R root:root /etc/dovecot 2>/dev/null || true
chmod 644 /etc/dovecot/dovecot.conf 2>/dev/null || true
chmod -R 644 /etc/dovecot/conf.d/*.conf 2>/dev/null || true
chmod 640 /etc/dovecot/dovecot-sql.conf.ext 2>/dev/null || true

exec dovecot -F
