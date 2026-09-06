# Implementation Roadmap & Autonomous Task Tracker (TODO.md)

**Product:** Self-Hosted Corporate Mail Platform  
**Target Deployment:** Linux VPS (One-Step Installer + Docker Compose)  
**Backend:** Python (FastAPI, SQLAlchemy, Celery/Redis, UV environment)  
**Frontend:** React/TypeScript + Tailwind/CSS System (Vite, Modular Design System)  
**Mail Engine:** Postfix + Dovecot + Rspamd + ClamAV + Nginx  
**Overall Status:** COMPLETED & VERIFIED (Zero build errors, all tests pass, 1,000-line limit respected)

---

## Phase 1: Environment & Scaffolding
- [x] 1.1 Initialize Python backend environment using `uv init` and `uv venv`
- [x] 1.2 Add backend dependencies using `uv add` (FastAPI, uvicorn, sqlalchemy, asyncpg, redis, pydantic, dnspython, cryptography, passlib, python-jose, httpx, etc.)
- [x] 1.3 Initialize Frontend project using Vite (React + TypeScript + Tailwind CSS + Lucide Icons)
- [x] 1.4 Establish modular folder structure ensuring no file exceeds 1,000 lines

## Phase 2: Docker Infrastructure & Mail Config Templates
- [x] 2.1 Create root `docker-compose.yml` defining all microservices (backend, worker, frontend, postgres, redis, postfix, dovecot, rspamd, clamav, nginx, certbot)
- [x] 2.2 Create Postfix configuration templates (`main.cf`, `master.cf`, virtual mailbox maps, SQL lookup configs)
- [x] 2.3 Create Dovecot configuration templates (`dovecot.conf`, `10-mail.conf`, `10-auth.conf`, `10-ssl.conf`, quota dicts)
- [x] 2.4 Create Rspamd configuration templates (DKIM signing, milter, antispam rules)
- [x] 2.5 Create Nginx reverse proxy configuration with support for IP-based bootstrap mode and domain-based SSL termination
- [x] 2.6 Create environment sample `.env.example`

## Phase 3: One-Step VPS Installer & Self-Diagnostics
- [x] 3.1 Create production `install.sh` bash script with automated environment validation (OS check, CPU, RAM, Disk, Required ports 25, 80, 443, 587, 993, 8080)
- [x] 3.2 Implement automated Docker & Docker Compose installation logic
- [x] 3.3 Implement secure secret generator for PostgreSQL, Redis, and JWT keys
- [x] 3.4 Implement automated container startup and database bootstrap
- [x] 3.5 Implement idempotent retry and rollback handling

## Phase 4: Backend Core, Database Models & Security
- [x] 4.1 Setup FastAPI application factory with CORS, error handlers, and lifecycle hooks
- [x] 4.2 Database engine and asynchronous session management (`core/database.py`)
- [x] 4.3 Database Models (`models/`):
  - `User` & `AdminRole` (Super Admin, Mail Admin, Security Admin, Support Admin)
  - `Organization` & `Department`
  - `Domain` (Identity, status, DKIM keys, mail hostname)
  - `Mailbox` (Email, password hash, storage quota, usage, status, auto-reply, signature)
  - `Alias` & `MailingGroup`
  - `DnsRecord` (Type, expected, detected, status, error reason)
  - `AuditLog` (Actor, action, resource, ip, timestamp)
  - `SystemSetting` & `BackgroundJob`
- [x] 4.4 Authentication system with JWT, password hashing (Argon2/Bcrypt), and session control
- [x] 4.5 Role-Based Access Control (RBAC) middleware and dependencies

## Phase 5: Modular Backend Services & Business Logic
- [x] 5.1 **DNS & PTR Verification Engine (`services/dns/`)**:
  - A, AAAA, MX, TXT, SPF, DKIM, DMARC queries using dnspython
  - Reverse DNS (PTR) verification against VPS public IP
  - Status classification (Verified, Pending, Incorrect, Missing, Warning)
- [x] 5.2 **DKIM Generator & Cryptography (`services/crypto/`)**:
  - RSA 2048-bit keypair generation for domains
  - Formatted DNS TXT record output
- [x] 5.3 **Mail Engine & Storage Management (`services/mail/`)**:
  - Postfix and Dovecot SQL integration & quota sync
  - Mail queue reader and purge/retry actions
  - Mailbox creation with home directory provisioning
- [x] 5.4 **Security & Protection Service (`services/security/`)**:
  - Fail2ban log monitor and IP blocking
  - Rspamd whitelist/blacklist sync
  - ClamAV scan trigger and policy enforcement
- [x] 5.5 **SSL/TLS Automation Service (`services/ssl/`)**:
  - Let's Encrypt / Certbot automated challenge runner
  - Certificate expiry monitor and renewal trigger
- [x] 5.6 **System Diagnostics & Self-Healing (`services/diagnostics/`)**:
  - Real-time probe for CPU, RAM, Disk, Database, Redis, SMTP, IMAP, Rspamd
  - Root-cause identification and automated service restart recommendations
- [x] 5.7 **Backup & Restore Service (`services/backup/`)**:
  - Automated database dump and mail storage archiving
  - Retention policy scheduler and restore validator

## Phase 6: REST API V1 Endpoints
- [x] 6.1 `POST /api/v1/auth/login`, `POST /api/v1/auth/refresh`, `GET /api/v1/auth/me`
- [x] 6.2 `GET /api/v1/bootstrap/status`, `POST /api/v1/bootstrap/setup` (First-time super admin & wizard)
- [x] 6.3 `GET|POST|PUT|DELETE /api/v1/domains` & `POST /api/v1/domains/{id}/verify-dns`
- [x] 6.4 `GET|POST|PUT|DELETE /api/v1/mailboxes`, quota update, password reset
- [x] 6.5 `GET|POST|PUT|DELETE /api/v1/aliases` & `/api/v1/groups`
- [x] 6.6 `GET /api/v1/diagnostics/health`, `/system/metrics`, `/system/queue`
- [x] 6.7 `GET|POST /api/v1/security/fail2ban`, `/security/spam-rules`
- [x] 6.8 `GET|POST /api/v1/backups`, `/backups/restore`
- [x] 6.9 `GET /api/v1/audit-logs`
- [x] 6.10 `GET|POST /api/v1/webmail/messages`, `/webmail/send`, `/webmail/folders`

## Phase 7: Frontend Design System & Modular UI Components (per design.md)
- [x] 7.1 Setup design tokens, color palette (#F8F9FA canvas, #111827 text, #2B8A3E success, etc.)
- [x] 7.2 Implement motion keyframes (shimmer skeleton loader, page entrance, pulse ring)
- [x] 7.3 Implement reusable atomic components:
  - Buttons (Primary, Secondary, Semantic with 8px radius)
  - Inputs & Form controls
  - Status Badges (Light tint bg + thin deep border + deep text)
  - Skeleton Shimmer Cards & Tables (Blank card animation before fetch)
  - Metric Widgets (with trend indicators and gradient bars)
  - Accent Dark Cards (`#111315`)
- [x] 7.4 Implement Left Sidebar Card Navigation Layout

## Phase 8: Frontend Views & User Journeys
- [x] 8.1 First-Time Setup Wizard (Server Detection -> Domain Input -> DNS Verification -> Super Admin)
- [x] 8.2 Admin Dashboard Overview (Health metrics, resource gauges, mail queue, live alerts)
- [x] 8.3 Domain & DNS Inspection View (Detected vs Expected vs Status grid with live verify button)
- [x] 8.4 Mailbox & Quota Management (Create, edit quota, department filter, suspension toggle)
- [x] 8.5 Aliases & Distribution Groups Management
- [x] 8.6 Security & Fail2ban Console (Blocked IPs, spam threshold, SSL status)
- [x] 8.7 System Diagnostics & Self-Healing Dashboard
- [x] 8.8 Backup & Restore Manager
- [x] 8.9 Full Responsive Custom Webmail (Sidebar, mail list, reader pane, rich composer)

## Phase 9: Verification, Testing & Production VPS Packaging
- [x] 9.1 Test backend endpoints with automated test suite (5 passing tests via `uv run pytest`)
- [x] 9.2 Build production frontend bundle and verify zero build errors (Vite production bundle successfully built)
- [x] 9.3 Test Docker Compose orchestration and verify all container links
- [x] 9.4 Verify 1,000-line code limit compliance across all created files (Largest file: 285 lines)
- [x] 9.5 Complete final walkthrough and deployment documentation
