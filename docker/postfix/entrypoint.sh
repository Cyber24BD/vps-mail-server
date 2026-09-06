#!/bin/sh
set -e

# Dynamically sync PRIMARY_HOSTNAME if provided in environment
if [ -n "$PRIMARY_HOSTNAME" ]; then
  postconf -e "myhostname = $PRIMARY_HOSTNAME"
  postconf -e "mydomain = ${PRIMARY_HOSTNAME#*.}"
fi

# Ensure alias database is indexed
if [ -f /etc/postfix/aliases ]; then
  postalias /etc/postfix/aliases 2>/dev/null || true
fi

# Ensure postdrop and spool permissions
postfix check 2>/dev/null || true

exec postfix start-fg
