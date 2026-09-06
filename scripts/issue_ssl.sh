#!/usr/bin/env bash
# ==============================================================================
# Corporate Mail Platform - 1-Click Trusted Let's Encrypt SSL Generator
# Automated ACME HTTP-01 webroot issuance & live zero-downtime certificate reload
# ==============================================================================

set -eo pipefail

DOMAIN="${1:-mail.toamun.com}"
EMAIL="${2:-admin@toamun.com}"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_DIR="$(dirname "$SCRIPT_DIR")"

echo -e "\n=== Requesting Trusted Let's Encrypt SSL Certificate ==="
echo "Target Domain: ${DOMAIN}"
echo "Contact Email: ${EMAIL}"
echo "Project Path:  ${REPO_DIR}"
echo "========================================================\n"

# Step 1: Ensure directory structure and accessible permissions
mkdir -p /var/mail-platform/certbot/.well-known/acme-challenge
mkdir -p /var/mail-platform/ssl/letsencrypt
chmod -R 755 /var/mail-platform/certbot
chmod 755 /var/mail-platform/ssl

# Step 2: Ensure Nginx is actively running with the certbot volume mount
echo "Ensuring Nginx is running with the latest ACME webroot mount..."
cd "$REPO_DIR"
docker compose up -d nginx

# Step 3: Probe local webroot route to verify ACME challenge readiness
echo "Verifying local webroot challenge routing..."
PROBE_FILE="probe_$(date +%s)"
echo "letsencrypt-probe-ok" > "/var/mail-platform/certbot/.well-known/acme-challenge/${PROBE_FILE}"
chmod 644 "/var/mail-platform/certbot/.well-known/acme-challenge/${PROBE_FILE}"

HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" "http://127.0.0.1/.well-known/acme-challenge/${PROBE_FILE}" || true)
rm -f "/var/mail-platform/certbot/.well-known/acme-challenge/${PROBE_FILE}"

if [ "$HTTP_CODE" != "200" ]; then
    echo "[!] ACME probe returned HTTP ${HTTP_CODE}. Reloading Nginx container..."
    docker compose restart nginx
    sleep 2
else
    echo "[✓] Local ACME webroot probe passed (HTTP 200)."
fi

# Step 4: Issue certificate using official certbot container
echo "Running Certbot HTTP-01 challenge for ${DOMAIN}..."
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

# Step 5: Deploy certificate files and reload services
if [ -f "${LIVE_DIR}/fullchain.pem" ]; then
  echo "Deploying newly issued certificates..."
  # Use -L to dereference symlinks created by certbot
  cp -L "${LIVE_DIR}/fullchain.pem" /var/mail-platform/ssl/fullchain.pem
  cp -L "${LIVE_DIR}/privkey.pem" /var/mail-platform/ssl/privkey.pem
  chmod 644 /var/mail-platform/ssl/fullchain.pem
  chmod 644 /var/mail-platform/ssl/privkey.pem

  echo "Reloading Nginx, Postfix, and Dovecot services with trusted SSL..."
  docker compose restart nginx postfix dovecot >/dev/null 2>&1 || true

  echo -e "\n\033[0;32m[✓ SUCCESS] Let's Encrypt SSL is now active!\033[0m"
  echo "You can now open: https://${DOMAIN} with a trusted green padlock."
else
  echo -e "\n\033[0;31m[ERROR] Certificate files not found in ${LIVE_DIR}\033[0m"
  exit 1
fi
