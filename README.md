# Enterprise Self-Hosted Corporate Mail Platform

A production-grade, self-hosted corporate email platform built with **Python (FastAPI, UV)**, **React/TypeScript (Vite)**, and **Dockerized Infrastructure** (**Postfix**, **Dovecot**, **Rspamd**, **ClamAV**, **PostgreSQL**, **Redis**, and **Nginx**).

---

## 🚀 One-Step VPS Production Deployment

Deploy this platform directly to an **Ubuntu 20.04 / 22.04 / 24.04 LTS** or **Debian 11 / 12** fresh VPS.

### 1. Clone & Run Installer
```bash
git clone <your-repository-url> /var/mail-platform
cd /var/mail-platform
chmod +x install.sh
sudo ./install.sh
```

### 2. What the Installer Does Automatically:
1. **Validates Host Environment:** Checks OS compatibility, CPU cores, free RAM (recommended 2GB–4GB), and root storage.
2. **Ports Audit:** Verifies availability of ports `25` (SMTP), `80` (HTTP), `443` (HTTPS), `587` (Submission), `993` (IMAPS), and `8080` (Bootstrap Control).
3. **Installs Container Engine:** Installs Docker Engine & Docker Compose if not found.
4. **Initializes Storage & Permissions:** Provisions `/var/mail-platform/vmail` and `/var/mail-platform/dkim` assigned to `vmail` (UID:GID 5000:5000).
5. **Generates Cryptographic Secrets:** Creates `.env` with unique random passwords for PostgreSQL, Redis, Rspamd, and JWT secrets.
6. **Generates Bootstrap SSL:** Creates self-signed certificates so the system is TLS-ready before Let's Encrypt domain activation.
7. **Starts Microservices:** Boots all 10 containers via Docker Compose and runs database migrations.
8. **Outputs Bootstrap URL:**
   ```text
   🌐 http://<YOUR_SERVER_IP>:8080
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

# Start development server
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
