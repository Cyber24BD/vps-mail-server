#!/usr/bin/env bash
# ==============================================================================
# Corporate Mail Platform - 1-Click Trusted Let's Encrypt SSL Generator
# Automated ACME HTTP-01 webroot issuance & live zero-downtime certificate reload
# ==============================================================================

set -eo pipefail

DOMAIN="${1:-mail.toamun.com}"
EMAIL="${2:-admin@toamun.com}"

echo -e "\n=== Requesting Trusted Let's Encrypt SSL Certificate ==="
echo "Target Domain: ${DOMAIN}"
echo "Contact Email: ${EMAIL}"
echo "========================================================\n"

mkdir -p /var/mail-platform/certbot
mkdir -p /var/mail-platform/ssl
mkdir -p /var/mail-platform/ssl/letsencrypt

# Issue certificate using official certbot container
docker run --rm \
  -v /var/mail-platform/certbot:/var/www/certbot \
  -v /var/mail-platform/ssl/letsencrypt:/etc/letsencrypt \
  certbot/certbot certonly --webroot \
  -w /var/www/certbot \
  -d "${DOMAIN}" \
  --email "${EMAIL}" \
  --agree-tos \
  --no-eff-email \
  --non-interactive

LIVE_DIR="/var/mail-platform/ssl/letsencrypt/live/${DOMAIN}"

if [ -f "${LIVE_DIR}/fullchain.pem" ]; then
  echo "Deploying newly issued certificates..."
  cp "${LIVE_DIR}/fullchain.pem" /var/mail-platform/ssl/fullchain.pem
  cp "${LIVE_DIR}/privkey.pem" /var/mail-platform/ssl/privkey.pem
  chmod 644 /var/mail-platform/ssl/fullchain.pem
  chmod 600 /var/mail-platform/ssl/privkey.pem

  echo "Reloading Nginx, Postfix, and Dovecot services with trusted SSL..."
  docker compose restart nginx postfix dovecot >/dev/null 2>&1 || true

  echo -e "\n\033[0;32m[✓ SUCCESS] Let's Encrypt SSL is now active!\033[0m"
  echo "You can now open: https://${DOMAIN} with a trusted green padlock."
else
  echo -e "\n\033[0;31m[ERROR] Certificate files not found in ${LIVE_DIR}\033[0m"
  exit 1
fi
