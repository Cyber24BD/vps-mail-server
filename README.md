# Enterprise Self-Hosted Corporate Mail Platform

A production-grade, self-hosted corporate email platform built with **Python (FastAPI, UV)**, **React/TypeScript (Vite)**, and **Dockerized Infrastructure** (**Postfix**, **Dovecot**, **Rspamd**, **ClamAV**, **PostgreSQL**, **Redis**, and **Nginx**).

---

## 🚀 One-Step VPS Production Deployment

Deploy this platform directly to an **Ubuntu 20.04 / 22.04 / 24.04 LTS** or **Debian 11 / 12** fresh VPS.

### 1. Clone & Run Installer
```bash
git clone https://github.com/Cyber24BD/vps-mail-server.git /var/mail-platform
cd /var/mail-platform
chmod +x install.sh
sudo ./install.sh
```

### 2. What the Installer Does Automatically:
1. **Validates Host Environment:** Checks OS compatibility, CPU cores, free RAM (recommended 2GB–4GB), and root storage.
2. **Ports Audit & Conflict Detection:** Checks ports `25` (SMTP), `80` (HTTP), `443` (HTTPS), `587` (Submission), `993` (IMAPS). Default Control Panel port is **`7080`** (dynamically shifts to `7081`, `7082` if occupied).
3. **Installs Container Engine:** Installs Docker Engine & Docker Compose if not found.
4. **Initializes Storage & Permissions:** Provisions `/var/mail-platform/vmail` and `/var/mail-platform/dkim` assigned to `vmail` (UID:GID 5000:5000).
5. **Generates Cryptographic Secrets:** Creates `.env` with unique random passwords for PostgreSQL, Redis, Rspamd, and JWT secrets.
6. **Synchronizes Mail Engine Credentials:** Automatically maps database credentials into Postfix and Dovecot SQL configurations.
7. **Generates Bootstrap SSL:** Creates self-signed certificates so the system is TLS-ready before Let's Encrypt domain activation.
8. **Starts Microservices:** Boots all 10 containers via Docker Compose and runs database migrations.
9. **Outputs Bootstrap URL:**
   ```text
   🌐 http://<YOUR_SERVER_IP>:7080
   ```

---

## 🔄 1-Click Zero-Data-Loss Updates

When you push new features, security updates, or bug fixes to GitHub, you can upgrade your production VPS platform in **one click** without losing any email data, SSL certificates, or configuration secrets!

### Option A: From the Admin Web Dashboard (1-Click UI)
1. Navigate to **Control Center &rarr; System Overview**.
2. Under the **"1-Click Platform Updater"** card, click **"1-Click Update Now"**.
3. The platform executes the update in the background with an automated SQL snapshot!

### Option B: From the VPS Terminal (1-Command CLI)
```bash
cd /var/mail-platform
sudo ./update.sh
```

#### What the Updater Does:
- **Pre-Update Safety Backup:** Dumps PostgreSQL database to `/var/mail-platform/backups/pre_update_<timestamp>.sql`.
- **Git Sync:** Fetches and pulls the latest code from `origin/main`.
- **Preserves Secrets:** Keeps `.env`, SSL certificates, DKIM keys, and Maildir storage strictly untouched.
- **Microservices Rebuild:** Runs `docker compose up -d --build` with near-zero downtime.
- **Flushes Stale DNS Cache:** Automatically restarts Nginx to ensure it connects to updated container network IPs.
- **Health Verification:** Probes database and container health to verify operational integrity.

---

## 🔒 Automated SSL/TLS Certificate Management (Let's Encrypt)

The platform comes with a 1-click script to issue official, trusted Let's Encrypt certificates using an automated ACME HTTP-01 challenge over Port 80 via Dockerized Certbot.

### 1. Issue Trusted SSL for your Mail Domain
Run directly from your VPS terminal:
```bash
cd /var/mail-platform
sudo ./scripts/issue_ssl.sh mail.yourdomain.com admin@yourdomain.com
```

#### What `issue_ssl.sh` does automatically:
1. Spawns an isolated `certbot/certbot` container using ACME webroot challenge.
2. Validates your domain against Nginx on Port 80.
3. Automatically deploys `fullchain.pem` and `privkey.pem` to `/var/mail-platform/ssl/`.
4. Hot-reloads **Nginx** (Webmail / Admin HTTPS), **Postfix** (SMTP Port 465/587), and **Dovecot** (IMAP Port 993) with zero downtime.

### 2. Automated Monthly SSL Renewals (Cron)
To automatically renew certificates every month, add a simple cron job:
```bash
# Open root crontab
sudo crontab -e

# Add monthly auto-renewal at 3:00 AM on the 1st of every month:
0 3 1 * * /var/mail-platform/scripts/issue_ssl.sh mail.yourdomain.com admin@yourdomain.com >> /var/log/ssl_renew.log 2>&1
```

---

## 🌐 Cloudflare & DNS Manager Automation

The platform includes a built-in **RFC-1035 / BIND Zone Export** tool to configure Cloudflare or any DNS registrar without manual typing.

### 1-Click Cloudflare DNS Import:
1. In the Admin Panel, select your domain under **Domains & DNS**.
2. Click the **"Export Cloudflare DNS (.txt)"** button.
3. Download the generated `.txt` file.
4. In your Cloudflare Dashboard: **Your Domain &rarr; DNS &rarr; Records &rarr; Import and Export &rarr; Import**.
5. Upload the `.txt` file. Cloudflare will automatically configure your **A**, **MX**, **SPF**, **DKIM**, and **DMARC** records!

> [!IMPORTANT]
> **Cloudflare Grey Cloud Rule:** Mail-related A-records (e.g. `mail.yourdomain.com`) **must be DNS Only (Grey Cloud)**, never Proxied (Orange Cloud). Cloudflare's HTTP proxy will block standard mail ports (25, 465, 587, 993). The export script automatically enforces `cf_tags=cf-proxied:false`.

### Reverse DNS (PTR) Requirement:
- Forward DNS (`mail.yourdomain.com` &rarr; IP) is set in Cloudflare.
- **Reverse DNS (PTR)** (IP &rarr; `mail.yourdomain.com`) **must be configured in your VPS hosting provider's dashboard** (where you purchased the server), because Cloudflare does not own your VPS's IP block.

---

## 🛠️ Super Administrator CLI & Disaster Recovery

Manage administrator accounts directly from the terminal without opening the web interface:

### 1. List All Active Administrators
```bash
docker compose exec backend python -m app.cli list-admins
```

### 2. Reset Administrator Password
```bash
docker compose exec backend python -m app.cli reset-password admin "YourNewStrongPassword123"
```

### 3. Create a Brand New Administrator
```bash
docker compose exec backend python -m app.cli create-admin admin admin@yourdomain.com "YourSecurePassword123"
```

---

## 💻 Local Development Workflow

Both backend and frontend utilize isolated modern development environments:

### Backend (Python with `uv`)
```bash
cd backend

# Run automated unit test suite
uv run pytest

# Start FastAPI development server
uv run uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```
API Documentation will be accessible at: `http://localhost:8000/docs`

### Frontend (React + TypeScript with Vite)
```bash
cd frontend

# Install dependencies
npm install

# Start development server (with automated /api proxy to backend)
npm run dev

# Compile production bundle
npm run build
```

---

## 🎨 UI/UX Design System Compliance

Developed strictly against [`design.md`](file:///d:/Development/Mail%20Syatem/design.md):
- **Color Theme:** Clean Gray-to-Black palette with high-contrast text (`#111827`).
- **Semantic Badges:** Very light tint background with thin deep border and deep text (e.g. `#EBFBEE` bg, `#2B8A3E` border, `#1B5E20` text for success).
- **Geometry:** Border radiuses strictly between 5px and 20px with crisp 1px borders and zero to ultra-low drop shadows.
- **Micro-Interactions:**
  - Skeleton Shimmer loader placeholder on blank cards while data is being fetched.
  - Smooth page and tab entrance transitions.
  - Active pulse rings indicating real-time sync.
- **Navigation:** Left Floating Card Sidebar (`border-radius: 18px`).
- **Iconography:** Rounded icon system using Lucide Icons (`lucide-react`).

---

## 📐 Architecture & Modularity

- **Strict 1,000-Line Limit:** Every file is strictly decoupled and modular (largest file in the codebase is 285 lines).
- **Storage Separation:** Application PostgreSQL database stores only structured metadata (domains, mailboxes, quotas, audit logs), while email bodies are stored in Maildir format under `/var/mail-platform/vmail/`.
- **Live DNS Resolver:** Real-time query verification across **A**, **MX**, **SPF**, **DKIM**, **DMARC**, and **PTR (Reverse DNS)** records.
- **Automated Security:** Integrates Postfix SASL with Dovecot, Rspamd milter filtering, ClamAV antivirus scanning, and Fail2ban brute-force protection.
- **Feature Flags:** Modular toggles in `.env` (`ENABLE_WEBMAIL`, `ENABLE_CLAMAV`, `ENABLE_BACKUPS`, `ENABLE_ALIASES`, etc.) allow easily adding or disabling features.
