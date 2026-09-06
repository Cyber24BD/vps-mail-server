#!/bin/sh
set -e

# Ensure proper ownership and permissions for Dovecot configs
chown -R root:root /etc/dovecot 2>/dev/null || true
chmod 644 /etc/dovecot/dovecot.conf 2>/dev/null || true
chmod -R 644 /etc/dovecot/conf.d/*.conf 2>/dev/null || true
chmod 640 /etc/dovecot/dovecot-sql.conf.ext 2>/dev/null || true

exec dovecot -F
