#!/bin/sh
set -e

# Dynamically sync PostgreSQL credentials from environment
if [ -n "$POSTGRES_PASSWORD" ]; then
  sed -i "s/password = .*/password = ${POSTGRES_PASSWORD}/g" /etc/postfix/sql/*.cf 2>/dev/null || true
fi
if [ -n "$POSTGRES_USER" ]; then
  sed -i "s/user = .*/user = ${POSTGRES_USER}/g" /etc/postfix/sql/*.cf 2>/dev/null || true
fi
if [ -n "$POSTGRES_DB" ]; then
  sed -i "s/dbname = .*/dbname = ${POSTGRES_DB}/g" /etc/postfix/sql/*.cf 2>/dev/null || true
fi

# Ensure alias database is indexed
if [ -f /etc/postfix/aliases ]; then
  postalias /etc/postfix/aliases 2>/dev/null || true
fi

# Ensure postdrop and spool permissions
postfix check 2>/dev/null || true

exec postfix start-fg
