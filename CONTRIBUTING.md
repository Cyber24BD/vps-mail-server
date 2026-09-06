# Contributing to Corporate Mail Platform

Thank you for your interest in contributing to the Corporate Mail Platform! We welcome contributions from developers worldwide.

---

## 🏛 Architectural Principles

Before contributing code, please review our core architectural rules:

1. **Strict 1,000-Line Limit Rule:**
   - No single source file (`.py`, `.ts`, `.tsx`, `.sql`) may exceed 1,000 lines of code.
   - Ideal production files should remain between 100 and 400 lines.
   - When a component or service grows, subdivide it into logical sub-modules.

2. **Decoupled Modularity (Plugin-Ready):**
   - Keep business logic in `services/`, database access in `repositories/`, data contracts in `schemas/`, and HTTP handlers in `api/v1/endpoints/`.
   - Adding a new feature must not require modifying existing unrelated models or endpoints.

3. **Design System Adherence ([`design.md`](file:///d:/Development/Mail%20Syatem/design.md)):**
   - Palette: Gray to black base theme with clean, light workspace.
   - Status indicators: Very light tint background + deep thin border + deep text.
   - Radiuses: Strictly between 5px and 20px.
   - Motion: Micro-interactions and skeleton shimmer placeholders while data loads.

---

## 🛠 Local Setup & Testing

### Backend
```bash
cd backend
uv sync
uv run pytest
```

### Frontend
```bash
cd frontend
npm install
npm run dev
npm run build
```

---

## 🚀 Submitting Pull Requests

1. Fork the repository on GitHub.
2. Create a feature branch (`git checkout -b feature/awesome-feature`).
3. Commit your changes (`git commit -m 'feat: add awesome feature'`).
4. Push to your branch (`git push origin feature/awesome-feature`).
5. Open a Pull Request with a clear description of the problem solved.
