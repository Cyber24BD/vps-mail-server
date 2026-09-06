# UI/UX Design System & Architectural Specification

**Product:** Self-Hosted Corporate Mail Platform  
**Target Applications:** Admin Control Panel & Custom Webmail Client  
**Version:** 1.0.0  
**Status:** Approved Specification  

---

## 1. Design Philosophy & Core Principles

The design of the Corporate Mail Platform follows a **Precision Engineering & Minimalist Flat** paradigm. It blends modern enterprise clarity with frictionless ergonomics, designed for system administrators and corporate employees who demand speed, legibility, and confidence in mission-critical environments.

### Core Tenets:
1. **Clarity Over Clutter:** Content and data density are prioritized over decorative elements.
2. **Crisp Flat Geometry:** Very low to zero drop-shadows; depth is established through fine-line borders, contrast, and subtle tonal shifts.
3. **Intentional Feedback & Micro-interactions:** Every action provides immediate visual confirmation using skeleton loaders, smooth micro-animations, and semantic state badges.
4. **Strict Modularity:** Atomic design structure where design tokens, components, and layouts are completely decoupled, reusable, and predictable.

---

## 2. Color Palette & Semantic Design Tokens

The foundational color scheme is rooted in high-contrast neutral grays transitioning to deep blacks, accented with precise semantic indicators.

### 2.1 Neutral Base Palette (Gray to Black)

| Token Name | Hex Value | Usage / Description |
| :--- | :--- | :--- |
| `surface-canvas` | `#F8F9FA` | Primary app canvas background (light, clean workspace) |
| `surface-card` | `#FFFFFF` | Primary card, modal, and container background |
| `surface-subtle` | `#F1F3F5` | Secondary container, table header, and hover backgrounds |
| `surface-contrast`| `#111315` | Accent dark card background (for high-priority widgets) |
| `border-subtle` | `#E5E7EB` | Ultra-thin standard divider and inactive borders (1px) |
| `border-deep` | `#2D3139` | High-contrast structural border, active focus rings, keyframes |
| `border-dark-card`| `#374151` | Subtle border for dark contrast cards |
| `text-primary` | `#111827` | Headings, primary metrics, active typography |
| `text-secondary` | `#4B5563` | Subtitles, labels, descriptions |
| `text-muted` | `#6B7280` | Placeholders, timestamps, helper texts |
| `text-on-dark` | `#F9FAFB` | Primary text on accent dark cards |

---

### 2.2 Semantic Status System

All semantic status badges, alerts, and table rows use the **"Subtle Fill + Deep Border + Deep Text"** standard for maximum readability and zero eye strain.

```
+-------------------------------------------------------------+
|  Status Box: [Icon] Status Message                          |
|  - Background: Very Light Tint (5-10% opacity)             |
|  - Border: Thin (1px - 1.5px) Deep Saturated Tone           |
|  - Text: High-Contrast Deep Color (WCAG AAA Compliant)      |
+-------------------------------------------------------------+
```

| State | Background Fill | Border Color (Thin) | Text Color (Deep) | Usage |
| :--- | :--- | :--- | :--- | :--- |
| **Success / Verified** | `#EBFBEE` | `#2B8A3E` | `#1B5E20` | DNS verified, SSL active, SMTP online |
| **Warning / Action Needed** | `#FFF9DB` | `#E67700` | `#A65D03` | DNS pending, queue delay, quota warning |
| **Danger / Failed** | `#FFF5F5` | `#C92A2A` | `#961C1C` | Service offline, auth attack, SPF invalid |
| **Info / Neutral** | `#E7F5FF` | `#1971C2` | `#114E87` | System notice, background job, release note |

---

### 2.3 Metric Trends & Chart Gradients

Data visualizations, health bars, and trend statistics represent increases or decreases through strict semantic gradients:

- **Positive / Health Metric (Good Increase / Optimal Health):**
  - Gradient: `linear-gradient(135deg, #2B8A3E 0%, #40C057 100%)`
  - Solid Line / Bar Fill: `#2B8A3E`
  - Trend Indicator: Light green pill (`#EBFBEE`), thin border (`#2B8A3E`), green arrow up `↑`.
- **Negative / Risk Metric (Bad Increase / Degraded Health):**
  - Gradient: `linear-gradient(135deg, #C92A2A 0%, #FA5252 100%)`
  - Solid Line / Bar Fill: `#C92A2A`
  - Trend Indicator: Light red pill (`#FFF5F5`), thin border (`#C92A2A`), red arrow down `↓` or alert up.
- **Resource Load (CPU / RAM / Disk Gauge):**
  - `0% - 65%`: `#2B8A3E` (Nominal)
  - `66% - 84%`: `#E67700` (Elevated)
  - `85% - 100%`: `#C92A2A` (Critical)

---

## 3. Typography & Scale

The system utilizes clean, modern, sans-serif fonts optimized for screen legibility (`Inter`, `system-ui`, `-apple-system`, `BlinkMacSystemFont`). Monospace fonts (`JetBrains Mono`, `Fira Code`) are strictly reserved for IP addresses, DNS records, terminal outputs, and ports.

| Level | Size | Weight | Line Height | Usage |
| :--- | :--- | :--- | :--- | :--- |
| **Display / H1** | `24px` (`1.5rem`) | 700 (Bold) | `32px` | Primary view header, system status title |
| **Heading / H2** | `20px` (`1.25rem`) | 600 (SemiBold) | `28px` | Section titles, modal headers, wizard steps |
| **Subheading / H3**| `16px` (`1.0rem`) | 600 (SemiBold) | `24px` | Card headers, table section titles |
| **Body / Regular** | `14px` (`0.875rem`)| 400 (Regular) | `20px` | Standard body text, form labels, mail body |
| **Body / Medium** | `14px` (`0.875rem`)| 500 (Medium) | `20px` | Table content, navigation links, buttons |
| **Caption / Small**| `12px` (`0.75rem`) | 500 (Medium) | `16px` | Timestamps, status pills, helper hints |
| **Code / Mono** | `13px` (`0.8125rem`)| 500 (Medium) | `18px` | DNS TXT/MX values, IP:Port, DKIM keys |

---

## 4. Geometry, Borders & Elevation

### 4.1 Border Radius Scale (Strict 5px to 20px)

No element may violate the 5px to 20px range. Pill badges and full-rounded avatars are normalized within this boundary.

```
[5px - 6px]           [8px - 10px]           [12px - 16px]          [18px - 20px]
Badges, Inputs       Buttons, Selects        Standard Cards         Modals, Sidebar Cards
```

- **`radius-sm` (5px - 6px):** Status badges, tag pills, inline search chips, table action buttons.
- **`radius-md` (8px - 10px):** Form input fields, dropdown trigger buttons, standard CTA buttons.
- **`radius-lg` (12px - 16px):** Metric widgets, data table containers, mail conversation thread card.
- **`radius-xl` (18px - 20px):** Floating card sidebar, interactive wizard panels, system modals.

---

### 4.2 Elevation & Border Styling

- **Shadow Rule:** Strictly **zero to ultra-low shadow**.
  - Default Container: `box-shadow: none;`
  - Floating / Overlay Container: `box-shadow: 0 4px 16px rgba(0, 0, 0, 0.04);`
- **Border Rule:** Contrast is achieved via a crisp, thin border:
  - Standard Card Border: `1px solid #E5E7EB`
  - Focused / Selected Card Border: `1.5px solid #2D3139`
  - Accent Dark Card Border: `1px solid #374151`
  - Semantic Container Border: `1px solid <semantic-deep-color>`

---

## 5. Animation & Motion Architecture

All transitions must feel instantaneous, physical, and restrained. Animations must enhance cognitive flow without distracting from system tasks.

### 5.1 Motion Constants

- **Fast Micro-interaction:** `150ms ease-out` (button press, hover state, tooltip reveal)
- **Standard Transition:** `250ms cubic-bezier(0.16, 1, 0.3, 1)` (dropdown toggle, accordion open, tab switch)
- **Entrance Transition:** `350ms cubic-bezier(0.16, 1, 0.3, 1)` (page route change, modal open)

---

### 5.2 Required Motion Patterns

#### A. Blank Card / Skeleton Shimmer Animation
Before backend data is fetched, all cards and table rows render skeleton placeholders.
- **Visual:** A neutral gray rectangle with an animated linear-gradient reflection passing through.
- **Keyframe:**
  ```css
  @keyframes shimmer {
    0% { background-position: -200% 0; }
    100% { background-position: 200% 0; }
  }
  .skeleton-box {
    background: linear-gradient(90deg, #F1F3F5 25%, #E9ECEF 50%, #F1F3F5 75%);
    background-size: 200% 100%;
    animation: shimmer 1.5s infinite linear;
    border-radius: 6px;
  }
  ```

#### B. Page & View Entrance Animation
When navigating across sidebar items, the view content renders with a subtle stagger:
- **Transform:** Initial `opacity: 0; transform: translateY(6px);`
- **Target:** `opacity: 1; transform: translateY(0px);`
- **Duration:** `250ms`

#### C. Card Hover & Interactive Feedback
- Hovering an actionable metric card elevates the border from `border-subtle` (`#E5E7EB`) to `border-deep` (`#2D3139`) with `transform: translateY(-1px)`.

#### D. Status Pulse Animation
Critical services or real-time processes show a delicate pulse:
- Ping dot with 8px diameter emitting a semi-transparent ring (`@keyframes pulse-ring`) to indicate live background sync (e.g., DNS resolver polling).

---

## 6. Iconography System

- **Standard Library:** **Lucide Icons** (Rounded variant) or **Tabler Icons** (Rounded cap & join).
- **Stroke Width:** Strictly `1.75px` to `2.0px` for optimal clarity on high-DPI displays.
- **Sizes:**
  - `14px`: Inline badge icon, secondary helper.
  - `18px`: Navigation menu item, table action button icon, input prefix.
  - `24px`: Metric card header icon, modal title icon.
  - `36px`: Large empty state illustrations, initial wizard checkpoint icon.

---

## 7. Layout & Navigation Architecture

### 7.1 Admin Dashboard: Left Sidebar Card Layout

The admin workspace employs an isolated **Floating Card Sidebar** on the left and a modular content viewport on the right.

```
+---------------------------------------------------------------------------------------------------+
|  [Logo & Platform Title]                     [Global Search / DNS Status]      [Admin Avatar]     |
+---------------------------------------------------------------------------------------------------+
| +-------------------------+ +-------------------------------------------------------------------+ |
| | [CARD SIDEBAR]          | | [MAIN CONTENT VIEWPORT]                                           | |
| | Border-radius: 18px     | |                                                                   | |
| | Border: 1px deep/subtle | | +-------------------+ +-------------------+ +-------------------+ | |
| |                         | | | Metric Card (1)   | | Metric Card (2)   | | Accent Dark Card  | | |
| | - Dashboard             | | | [Service Health]  | | [Mail Queue]      | | [Quick DNS Tool]  | | |
| | - Organization          | | +-------------------+ +-------------------+ +-------------------+ | |
| | - Domains               | |                                                                   | |
| | - Mailboxes             | | +---------------------------------------------------------------+ | |
| | - Aliases & Groups      | | | Data Table / Live Inspection Card                             | | |
| | - Webmail Access        | | | - Detected vs Expected vs Status Grid                         | | |
| | - DNS Management        | | | - Action items with deep border buttons                       | | |
| | - Security & Fail2ban   | | +---------------------------------------------------------------+ | |
| | - System Diagnostics    | |                                                                   | |
| | - Backup & Restore      | |                                                                   | |
| | - Audit Logs            | |                                                                   | |
| | - Settings              | |                                                                   | |
| +-------------------------+ +-------------------------------------------------------------------+ |
+---------------------------------------------------------------------------------------------------+
```

### 7.2 Webmail Interface Layout

The Custom Webmail interface utilizes a responsive multi-pane layout:
1. **Sidebar Navigation (200px):** Inbox, Sent, Drafts, Trash, Spam, Custom Labels, Storage Quota Bar.
2. **Mail List View (320px - 380px):** Thread snippet, sender, unread dot, snippet preview, paperclip attachment indicator.
3. **Reading / Compose Pane (Flexible):** High-clarity reading header, reply/forward bar, attachment chips with scan status, clean formatted message viewer.

---

## 8. Component Specifications

### 8.1 Buttons

- **Height Scale:** Small (`32px`), Medium (`40px`), Large (`48px`).
- **Radius:** `8px` (Buttons strictly maintain rounded-corner rectangles).
- **Variants:**
  - **Primary (High Contrast):** Background `#111827`, Text `#FFFFFF`, Border `1px solid #111827`. Hover: `#2D3139`.
  - **Secondary (Subtle Outline):** Background `#FFFFFF`, Text `#111827`, Border `1px solid #2D3139`. Hover: `#F8F9FA`.
  - **Semantic (Danger/Action):** Background `#FFF5F5`, Text `#961C1C`, Border `1px solid #C92A2A`.
  - **Ghost / Icon Action:** Background `transparent`, Text `#4B5563`, Border `1px solid transparent`. Hover: Background `#F1F3F5`, Border `#E5E7EB`.

---

### 8.2 Form Controls & Inputs

- **Height:** `40px` (standard input, select, search).
- **Radius:** `8px`.
- **Base State:** Background `#FFFFFF`, Border `1px solid #D1D5DB`, Text `#111827`.
- **Focus State:** Border `1.5px solid #111827`, Outline `none`.
- **Error State:** Border `1.5px solid #C92A2A`, Background `#FFF5F5`.

---

### 8.3 Data Tables & Grids

- **Header:** Height `44px`, Background `#F8F9FA`, Border-bottom `1.5px solid #E5E7EB`, Font `12px Medium #4B5563 Uppercase`.
- **Row:** Height `52px`, Background `#FFFFFF`, Border-bottom `1px solid #F1F3F5`. Hover: Background `#F9FAFB`.
- **Action Columns:** Pinned right, subtle icons with tooltips.

---

### 8.4 Metric Cards

- **Light Card:** White background `#FFFFFF`, Border `1px solid #E5E7EB`, Radius `14px`. Contains metric value, label, and trend pill badge.
- **Accent Dark Card:** Deep dark background `#111315`, Border `1px solid #374151`, Radius `14px`, Text `#F9FAFB`. Used sparingly for system server uptime, live memory load, or active alert tallies.

---

## 9. Codebase Modularity & Architecture Guidelines

To guarantee high maintainability, code reuse, and long-term stability:

### 9.1 The 1000-Line Limit Rule
- **Zero Monolithic Files:** No single file may exceed **1,000 lines** of code.
- **Target File Size:** Normal production files must remain between **100 and 400 lines**.
- When a service, model, or UI view grows towards 600 lines, it must be subdivided into sub-modules (e.g., `services/dns/checker.py`, `services/dns/parser.py`, `services/dns/generator.py`).

### 9.2 Frontend Directory Structure (Component-Based)

```text
frontend/
├── src/
│   ├── assets/                 # SVGs, brand logos, font definitions
│   ├── components/             # Reusable Atomic & Compound UI Components
│   │   ├── buttons/            # PrimaryBtn, SecondaryBtn, IconBtn
│   │   ├── cards/              # MetricCard, DarkAccentCard, DetailCard
│   │   ├── badges/             # StatusPill, TrendBadge, CountBadge
│   │   ├── forms/              # TextInput, PasswordInput, SearchBar, SelectBox
│   │   ├── feedback/           # SkeletonCard, ShimmerTable, Toast, Modal
│   │   ├── charts/             # HealthGauge, TrendLine, QuotaDonut
│   │   └── navigation/         # SidebarCard, TopNavbar, TabGroup
│   ├── layouts/                # AdminLayout, WebmailLayout, AuthLayout
│   ├── views/                  # Page-level views
│   │   ├── dashboard/          # DashboardOverview, HealthWidgetGroup
│   │   ├── domains/            # DomainList, DomainWizard, DnsVerificationView
│   │   ├── mailboxes/          # MailboxTable, QuotaModal, AliasManager
│   │   ├── security/           # Fail2banView, SpamSettings, SslStatus
│   │   └── webmail/            # MailListView, MessageViewer, ComposerModal
│   ├── hooks/                  # Custom React/Vue composition hooks
│   ├── services/               # API clients, WebSocket listeners, cache utils
│   ├── stores/                 # State management (authStore, systemStore, mailStore)
│   ├── styles/                 # Design tokens (colors.css, typography.css, animations.css)
│   └── types/                  # TypeScript interface contracts
```

### 9.3 Backend Modular Architecture (Clean Separation)

```text
backend/
├── app/
│   ├── api/
│   │   ├── v1/                 # Versioned API routes (auth, domains, mailboxes, dns, health)
│   │   └── deps.py             # Dependency injection (db, current_user, permissions)
│   ├── core/                   # Security, config, database session, redis connector
│   ├── models/                 # SQLAlchemy domain models (User, Domain, Mailbox, Log)
│   ├── schemas/                # Pydantic request/response schemas
│   ├── repositories/           # Database access layer (DomainRepository, MailboxRepo)
│   ├── services/               # Business logic modules (DNS, Postfix, Dovecot, SSL, ClamAV)
│   │   ├── dns/                # Resolver, PTR validation, SPF/DKIM generator
│   │   ├── mail_engine/        # Dovecot quota, Postfix config sync, Queue reader
│   │   ├── security/           # Rspamd client, Fail2ban sync, SSL certbot runner
│   │   └── diagnostics/        # Health check probes, Self-repair automation
│   ├── workers/                # Background tasks (Celery/ARQ job definitions)
│   └── templates/              # Safe configuration file templates (postfix, dovecot, rspamd)
```

---

## 10. Summary Verification Checklist

Before releasing any UI view or service component, verify:
- [x] Primary canvas is light theme with selected accent dark cards where appropriate.
- [x] All borders are crisp and thin (1px to 1.5px), avoiding heavy drop shadows.
- [x] Border radiuses strictly adhere to 5px–20px limits.
- [x] Status colors follow the light background + deep thin border + deep text standard.
- [x] Skeleton shimmer animations display during asynchronous data loading.
- [x] Icons are rounded variants from Lucide / Tabler.
- [x] No code file exceeds 1,000 lines; components are modular and reusable.
