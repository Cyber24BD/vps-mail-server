#!/bin/sh
set -e

# Ensure alias database is indexed
if [ -f /etc/postfix/aliases ]; then
  postalias /etc/postfix/aliases 2>/dev/null || true
fi

# Ensure postdrop and spool permissions
postfix check 2>/dev/null || true

exec postfix start-fg
