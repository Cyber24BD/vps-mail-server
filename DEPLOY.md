# Corporate Mail Platform — Production Deployment & Operations Manual

This guide covers complete instructions on **installing on a fresh VPS**, **updating without data loss**, **restarting services**, **monitoring live logs**, and **managing routine operations** for the Self-Hosted Corporate Mail Platform.

---

## 📋 Table of Contents
1. [System Requirements & Prerequisites](#1-system-requirements--prerequisites)
2. [Port Allocation & Network Requirements](#2-port-allocation--network-requirements)
3. [Fresh VPS Installation Guide](#3-fresh-vps-installation-guide)
4. [DNS & Authentication Configuration](#4-dns--authentication-configuration)
5. [Issuing Trusted Let's Encrypt SSL](#5-issuing-trusted-lets-encrypt-ssl)
6. [How to Update on VPS (Zero Data Loss)](#6-how-to-update-on-vps-zero-data-loss)
7. [How to Restart Mail Services & Docker](#7-how-to-restart-mail-services--docker)
8. [Live Logs, Diagnostics & Queue Management](#8-live-logs-diagnostics--queue-management)
9. [Routine Maintenance & Database Backups](#9-routine-maintenance--database-backups)
10. [Troubleshooting Playbook](#10-troubleshooting-playbook)

---

## 1. System Requirements & Prerequisites

### Hardware Requirements
| Resource | Minimum | Recommended (Production) |
| :--- | :--- | :--- |
| **Operating System** | Ubuntu 22.04 / 24.04 LTS, Debian 12 | Ubuntu 24.04 LTS (Clean minimal install) |
| **CPU** | 1 vCPU | 2+ vCPUs |
| **RAM** | 2 GB (with swap) | 4 GB+ (for Rspamd & ClamAV Antivirus) |
| **Storage** | 20 GB SSD | 50 GB+ NVMe SSD |

### Critical VPS Provider Requirements
> [!IMPORTANT]
> **Before deploying**, ensure your VPS provider supports mail hosting:
> 1. **Outbound Port 25 Unblocked:** Major providers (Hetzner, Vultr, Linode, DigitalOcean, AWS) block outbound Port 25 by default. You must open a support ticket to unblock Port 25 for SMTP delivery.
> 2. **Reverse DNS (PTR) Support:** Your VPS provider must allow setting a PTR record for your VPS IP address (e.g. `163.227.239.239` &rarr; `mail.yourdomain.com`).

---

## 2. Port Allocation & Network Requirements

Ensure the following ports are open in your cloud firewall (Security Groups / UFW):

| Port | Protocol | Service | Description |
| :--- | :--- | :--- | :--- |
| **25** | TCP | SMTP Gateway | Inbound & Outbound server-to-server mail delivery |
| **80** | TCP | HTTP / ACME | Let's Encrypt HTTP-01 SSL verification |
| **443** | TCP | HTTPS | Webmail & Secure Admin Dashboard |
| **465** | TCP | SMTPS | Encrypted SMTP Submission (SSL/TLS) |
| **587** | TCP | SMTP Submission | Client mail submission (STARTTLS) |
| **143** | TCP | IMAP | Client incoming mail (STARTTLS) |
| **993** | TCP | IMAPS | Encrypted incoming mail (SSL/TLS) |
| **7080** | TCP | HTTP Control | Bootstrap Web Admin Portal |

---

## 3. Fresh VPS Installation Guide

### Step 1: Prepare the Server
Log in to your VPS as `root` and ensure the system is up to date:
```bash
sudo apt update && sudo apt upgrade -y
sudo apt install -y curl git ufw
```

### Step 2: Clone the Repository
Clone the repository into your preferred deployment directory (e.g., `/root/vps-mail-server` or `/var/mail-platform`):
```bash
git clone https://github.com/Cyber24BD/vps-mail-server.git /root/vps-mail-server
cd /root/vps-mail-server
```

### Step 3: Run the Master Installer
Make the installer executable and launch it:
```bash
chmod +x install.sh
sudo ./install.sh
```

#### What the installer does automatically:
1. **Validates Host Environment:** Checks OS, RAM, CPU, root storage, and network ports.
2. **Installs Docker & Compose:** Automatically detects and installs official Docker Engine if not present.
3. **Provisions Storage Structure:** Creates `/var/mail-platform/vmail` and `/var/mail-platform/dkim` owned by `vmail:vmail` (UID:GID `5000:5000`).
4. **Generates Cryptographic Secrets:** Creates a secure `.env` file with unique passwords for PostgreSQL, Redis, Rspamd, and JWT tokens.
5. **Configures Firewall:** Automatically opens required ports in `ufw` without blocking SSH.
6. **Generates Bootstrap SSL:** Creates a temporary certificate so HTTPS is functional before domain issuance.
7. **Starts All Microservices:** Builds and boots the 10 core containers via Docker Compose.
8. **Initializes Database:** Applies initial database schemas and seeds default settings.

---

## 4. DNS & Authentication Configuration

In your DNS provider (e.g., **Cloudflare**, Namecheap, Route53), create the following DNS records.

> [!TIP]
> If using Cloudflare, set the **`mail`** record to **DNS Only (Grey Cloud)** so mail traffic bypasses Cloudflare's HTTP proxy.

### Required DNS Records:
| Type | Name / Host | Value | Proxy Status | Purpose |
| :--- | :--- | :--- | :--- | :--- |
| **A** | `mail` | `<YOUR_VPS_IP>` | **DNS Only** (Grey) | Mail server hostname |
| **MX** | `@` | `mail.yourdomain.com` (Priority 10) | N/A | Inbound mail routing |
| **TXT** | `@` | `v=spf1 mx ip4:<YOUR_VPS_IP> ~all` | N/A | SPF validation |
| **TXT** | `_dmarc` | `v=DMARC1; p=quarantine; rua=mailto:dmarc@yourdomain.com` | N/A | DMARC policy |
| **TXT** | `mail._domainkey` | `v=DKIM1; k=rsa; p=<YOUR_DKIM_PUBLIC_KEY>` | N/A | DKIM signing key |

### Reverse DNS (PTR Record)
In your VPS hosting provider's panel (or via support ticket), set the PTR record:
* **IP:** `<YOUR_VPS_IP>`
* **PTR Target:** `mail.yourdomain.com`

---

## 5. Issuing Trusted Let's Encrypt SSL

Once your `mail` A record points to your VPS IP, issue an official trusted SSL certificate:

```bash
cd /root/vps-mail-server
sudo ./scripts/issue_ssl.sh mail.yourdomain.com admin@yourdomain.com
```

#### What this script handles:
- Synchronizes Nginx webroot ACME challenge mounts.
- Requests the certificate from Let's Encrypt via Dockerized Certbot.
- Deploys certificates (`fullchain.pem` & `privkey.pem`) to `/var/mail-platform/ssl/`.
- Hot-reloads **Nginx** (Web), **Postfix** (SMTP Port 465/587), and **Dovecot** (IMAP Port 993) simultaneously.

### Automated Monthly SSL Renewal
Add a cron job to automatically check and renew the certificate on the 1st of every month at 3:00 AM:
```bash
(crontab -l 2>/dev/null; echo "0 3 1 * * /root/vps-mail-server/scripts/issue_ssl.sh mail.yourdomain.com admin@yourdomain.com >> /var/log/ssl_renew.log 2>&1") | crontab -
```

---

## 6. How to Update on VPS (Zero Data Loss)

When new code, security patches, or features are pushed to GitHub, update your server using one of the methods below. All mailbox data, emails, database records, and SSL certificates are stored outside the code repository in `/var/mail-platform/` and will **never** be lost.

### Method 1: The Automated 1-Click Update Script (Recommended)
```bash
cd /root/vps-mail-server    # Or your installation directory: /var/mail-platform
sudo ./update.sh
```

**What the script does:**
1. **Safety Pre-Snapshot:** Automatically backs up PostgreSQL database to `/var/mail-platform/backups/`.
2. **Conflict Prevention:** Safely stashes local modifications so `git pull` never fails with merge conflicts.
3. **Repository Sync:** Pulls the latest commits from `origin/main`.
4. **Credential Mapping:** Automatically re-maps database passwords to Postfix & Dovecot SQL configurations.
5. **Microservice Rebuild:** Rebuilds images and starts updated containers via `docker compose up -d --build`.
6. **Health Verification:** Verifies PostgreSQL and service health.
7. **Interactive Post-Update Service Restart:**
   Prompts you to re-initialize services cleanly:
   - **`1) [Recommended] Restart EVERYTHING`**: Restarts all microservices (DB, Python Backend/Worker, Mail Servers: Postfix/Dovecot/Rspamd/ClamAV, JS Frontend, Nginx Proxy) and optionally prompts to restart the host Docker engine daemon (`systemctl restart docker`).
   - **`2) Ask for EVERY SINGLE component individually`**: Step-by-step prompt for Mail, Python, JS, Proxy, Database, and Docker Engine.
   - **`3-6) Targeted component restart`**: Restart only Mail services, Python servers, JS frontend, or Docker daemon.
   - **`7) Skip restart`**: Keep current running container instances.
8. **Live Container Summary:** Displays `docker compose ps` with live status for all containers.

**Available CLI Flags:**
```bash
sudo ./update.sh --force          # Force rebuild even if commit hash matches
sudo ./update.sh --restart-all    # Automatically restart everything without prompting
sudo ./update.sh --skip-restart   # Skip service restart
sudo ./update.sh --non-interactive # Run unattended (auto-restarts all services)
```

### Method 2: Manual Update Sequence
If you prefer running the commands step-by-step:
```bash
cd /root/vps-mail-server

# 1. Reset any local changes to ensure clean merge
git checkout -- .
git pull origin main

# 2. Re-synchronize PostgreSQL credentials from .env to SQL mapping configs
POSTGRES_PASS=$(grep '^POSTGRES_PASSWORD=' .env | cut -d '=' -f2)
sed -i "s/password = .*/password = ${POSTGRES_PASS}/g" docker/postfix/sql/*.cf
sed -i "s/password=[^ ]*/password=${POSTGRES_PASS}/g" docker/dovecot/dovecot-sql.conf.ext

# 3. Rebuild and restart microservices
docker compose up -d --build
```

### Method 3: From the Web Control Center (Web UI)
1. Log in to the Admin Dashboard at `https://mail.yourdomain.com` or `http://<SERVER_IP>:7080`.
2. Navigate to **Control Center &rarr; System Overview**.
3. Locate the **1-Click Platform Updater** card and click **"1-Click Update Now"**.

---

## 7. How to Restart Mail Services & Docker

### Restart All Services (Full Stack)
To restart all 10 containers without rebuilding:
```bash
cd /root/vps-mail-server
docker compose restart
```

### Full Clean Stop & Start
To completely tear down the network and bring up all containers cleanly:
```bash
cd /root/vps-mail-server
docker compose down
docker compose up -d
```

### Restart Specific Mail Components
| To Restart | Command |
| :--- | :--- |
| **Postfix (SMTP Engine)** | `docker compose restart postfix` |
| **Dovecot (IMAP & Delivery)** | `docker compose restart dovecot` |
| **Rspamd (Spam & DKIM)** | `docker compose restart rspamd` |
| **Nginx (Web & SSL Proxy)** | `docker compose restart nginx` |
| **Database (PostgreSQL)** | `docker compose restart postgres` |
| **Redis (Cache & Rate Limiting)** | `docker compose restart redis` |
| **Backend API & Scheduler** | `docker compose restart backend worker` |

### Graceful Configuration Reload (Zero Container Downtime)
If you made configuration changes and want to reload without restarting the container:
```bash
# Reload Postfix configuration
docker exec corpmail-postfix postfix reload

# Reload Dovecot configuration
docker exec corpmail-dovecot doveadm reload

# Reload Nginx configuration
docker exec corpmail-nginx nginx -s reload
```

---

## 8. Live Logs, Diagnostics & Queue Management

### Streaming Live Logs
Watch mail transactions, connections, and security decisions in real-time:

```bash
# Live Postfix SMTP delivery and handshake logs
docker logs -f corpmail-postfix

# Live Dovecot IMAP logins and LMTP mailbox deliveries
docker logs -f corpmail-dovecot

# Live Rspamd spam scoring and DKIM signature logs
docker logs -f corpmail-rspamd

# Live Nginx web server and proxy logs
docker logs -f corpmail-nginx

# Live Backend API logs
docker logs -f corpmail-backend
```

### Inspecting & Managing the Postfix Mail Queue
```bash
# View all currently queued/deferred messages
docker exec corpmail-postfix postqueue -p

# Force Postfix to flush the queue and attempt immediate delivery
docker exec corpmail-postfix postqueue -f

# Delete a specific message from queue by Queue ID
docker exec corpmail-postfix postsuper -d <QUEUE_ID>

# Delete ALL messages from queue (caution)
docker exec corpmail-postfix postsuper -d ALL
```

### Instant Database & Mailbox Lookup Verification
Verify that Postfix can read your domains and mailboxes directly from PostgreSQL:
```bash
# Test Domain lookup (should return your domain name)
docker exec corpmail-postfix postmap -q "yourdomain.com" pgsql:/etc/postfix/sql/pgsql-virtual-mailbox-domains.cf

# Test Mailbox lookup (should return the maildir path, e.g. yourdomain.com/username/)
docker exec corpmail-postfix postmap -q "user@yourdomain.com" pgsql:/etc/postfix/sql/pgsql-virtual-mailbox-maps.cf
```

---

## 9. Routine Maintenance & Database Backups

### Automated Database Backup
To create an on-demand SQL dump of your mail platform:
```bash
mkdir -p /var/mail-platform/backups
docker compose exec -T postgres pg_dump -U mailuser corpmail > /var/mail-platform/backups/backup_$(date +%Y%m%d_%H%M%S).sql
```

### Restoring a Database Snapshot
To restore from an existing SQL backup file:
```bash
docker compose exec -T postgres psql -U mailuser -d corpmail < /var/mail-platform/backups/your_backup_file.sql
```

### Mail Storage Location
All physical user mailboxes and emails are stored in Maildir format under:
```text
/var/mail-platform/vmail/<domain>/<username>/
```
This directory is preserved across all container restarts, updates, and Docker rebuilds.

---

## 10. Troubleshooting Playbook

### Problem 1: Emails Going to Spam
1. **Check PTR (Reverse DNS):** Verify that your VPS IP resolves to your mail hostname:
   ```bash
   dig -x <YOUR_VPS_IP> +short
   ```
   If empty, contact your VPS provider to configure Reverse DNS.
2. **Check DKIM Key Alignment:** Ensure the public key in Cloudflare DNS matches the server's private key:
   ```bash
   openssl rsa -in /var/mail-platform/dkim/yourdomain.com.mail.key -pubout -outform DER 2>/dev/null | base64 -w 0; echo ""
   ```
   Compare the output with the `p=` value in Cloudflare's `mail._domainkey` record.
3. **Audit with Mail-Tester:** Send a test email to [mail-tester.com](https://www.mail-tester.com) to get a full 10/10 breakdown report.

### Problem 2: Outgoing Emails Timeout or Never Arrive
- Check if your VPS provider blocks outbound Port 25:
  ```bash
  curl -v telnet://smtp.gmail.com:25
  ```
  If it times out or fails to connect, Port 25 outbound is blocked by your hosting provider's firewall. Request Port 25 unblocking via their support ticket system.

### Problem 3: Incoming Mail Fails with "Relay Access Denied"
- Verify that your domain is active in PostgreSQL:
  ```bash
  docker exec corpmail-postgres psql -U mailuser -d corpmail -c "SELECT name, is_active FROM domains;"
  ```
  If `is_active` is `f` (false), activate it:
  ```bash
  docker exec corpmail-postgres psql -U mailuser -d corpmail -c "UPDATE domains SET is_active = true WHERE LOWER(name) = 'yourdomain.com';"
  ```

### Problem 4: Browser Shows "Not Secure" or SSL Warning
- Ensure Let's Encrypt certificates are issued and deployed:
  ```bash
  sudo ./scripts/issue_ssl.sh mail.yourdomain.com admin@yourdomain.com
  ```
- Verify Nginx certificate expiration:
  ```bash
  openssl x509 -in /var/mail-platform/ssl/fullchain.pem -noout -enddate -issuer
  ```
