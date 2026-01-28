# 🔭 Panoptic

<div align="center">

![Panoptic Logo](logo/panoptic_icon_white.png)

**DevOps Admin Dashboard für LLM-Kostenüberwachung**

*Behalte den Überblick über deine KI-Ausgaben – lokal, sicher und in Echtzeit.*

[![Tauri](https://img.shields.io/badge/Tauri-2.0-blue?logo=tauri)](https://tauri.app/)
[![React](https://img.shields.io/badge/React-18-61dafb?logo=react)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0-3178c6?logo=typescript)](https://www.typescriptlang.org/)
[![License](https://img.shields.io/badge/License-MIT-green)](LICENSE)

</div>

---

## ✨ Features

### 📊 LLM-Kostenüberwachung
- **OpenAI** – Vollständige Integration mit Admin API
  - Echtzeit-Kosten pro Tag/Woche/Monat
  - Aufschlüsselung nach Projekten
  - Token-Verbrauch (Input/Output)
- **Anthropic (Claude)** – Integration für Organisationen
- **Google Gemini** – Key-Validierung & Modell-Übersicht

### 🔐 Sicherheit
- **Lokale Datenspeicherung** – Alle sensiblen Daten bleiben auf deinem Gerät
- **SQLite-Datenbank** – Verschlüsselte Speicherung von API-Keys
- **Biometrische Authentifizierung** – Touch ID (macOS) / Windows Hello
- **Auto-Lock** – Automatische Sperrung bei Inaktivität

### 📈 Dashboard
- Interaktive Kosten-Charts (Recharts)
- Projekt-Filter und Detailansicht
- API-Key-Diagnose für alle Provider
- Audit-Log für alle Aktionen

### 🎨 Moderne UI
- Dark Mode Design
- Responsive Layout
- shadcn/ui Komponenten
- Tailwind CSS Styling

---

## 🖼️ Screenshots

<div align="center">

| Dashboard | LLM-Kosten | Secrets |
|:---------:|:----------:|:-------:|
| ![Dashboard](https://via.placeholder.com/300x200/1a1a2e/ffffff?text=Dashboard) | ![Costs](https://via.placeholder.com/300x200/1a1a2e/ffffff?text=LLM+Costs) | ![Secrets](https://via.placeholder.com/300x200/1a1a2e/ffffff?text=Secrets) |

</div>

---

## 🚀 Installation

### Voraussetzungen

- [Node.js](https://nodejs.org/) (v18+)
- [Rust](https://rustup.rs/) (für Tauri)
- [pnpm](https://pnpm.io/) oder npm

### Setup

```bash
# Repository klonen
git clone https://github.com/yourusername/panoptic.git
cd panoptic

# Abhängigkeiten installieren
npm install

# Entwicklungsserver starten
npm run tauri dev

# Produktions-Build erstellen
npm run tauri build
```

---

## ⚙️ Konfiguration

### API-Keys einrichten

1. **OpenAI Admin Key** (empfohlen)
   - Gehe zu [platform.openai.com](https://platform.openai.com)
   - Settings → Organization → Admin API keys
   - Erstelle einen neuen Admin Key
   - Füge ihn in Panoptic unter "Secrets" hinzu

2. **Anthropic** (nur für Organisationen)
   - [console.anthropic.com](https://console.anthropic.com) → Settings → Admin API

3. **Google Gemini**
   - [aistudio.google.com](https://aistudio.google.com) → Get API Key
   - *Hinweis: Keine Usage-API verfügbar, nur Key-Validierung*

---

## 🏗️ Tech Stack

| Kategorie | Technologie |
|-----------|-------------|
| **Framework** | [Tauri 2.0](https://tauri.app/) |
| **Frontend** | [React 18](https://react.dev/) + [TypeScript](https://www.typescriptlang.org/) |
| **Styling** | [Tailwind CSS](https://tailwindcss.com/) + [shadcn/ui](https://ui.shadcn.com/) |
| **State** | [TanStack Query](https://tanstack.com/query) |
| **Charts** | [Recharts](https://recharts.org/) |
| **Database** | SQLite (via Tauri SQL Plugin) |
| **Build** | [Vite](https://vitejs.dev/) |

---

## 📁 Projektstruktur

```
panoptic/
├── src/                    # React Frontend
│   ├── components/         # UI-Komponenten
│   │   ├── layout/         # Layout (Sidebar, etc.)
│   │   └── ui/             # shadcn/ui Komponenten
│   ├── hooks/              # React Hooks
│   ├── lib/                # API-Clients & Utilities
│   │   ├── openai.ts       # OpenAI API Integration
│   │   ├── anthropic.ts    # Anthropic API Integration
│   │   ├── gemini.ts       # Gemini API Integration
│   │   ├── secrets.ts      # Secrets Management
│   │   └── database.ts     # SQLite Database
│   └── pages/              # Seiten-Komponenten
│       ├── Dashboard.tsx
│       ├── Costs.tsx
│       ├── Secrets.tsx
│       └── Settings.tsx
├── src-tauri/              # Rust Backend
│   ├── src/
│   │   ├── main.rs
│   │   └── lib.rs
│   └── tauri.conf.json
├── public/                 # Statische Assets
└── logo/                   # App Icons
```

---

## 🛣️ Roadmap

- [x] OpenAI Kostenüberwachung
- [x] Multi-Key Support
- [x] Projekt-Filterung
- [x] Anthropic Integration (Org-Accounts)
- [x] Gemini Key-Validierung
- [ ] Google Cloud Billing API (Vertex AI)
- [ ] OneDrive Sync
- [ ] Server-Monitoring
- [ ] Benutzerverwaltung für eigene Apps
- [ ] Export-Funktionen (CSV, PDF)

---

## 🤝 Contributing

Beiträge sind willkommen! Bitte erstelle einen Issue oder Pull Request.

```bash
# Fork erstellen
# Feature-Branch erstellen
git checkout -b feature/AmazingFeature

# Änderungen committen
git commit -m 'Add some AmazingFeature'

# Branch pushen
git push origin feature/AmazingFeature

# Pull Request erstellen
```

---

## 📄 Lizenz

Dieses Projekt ist unter der MIT-Lizenz lizenziert. Siehe [LICENSE](LICENSE) für Details.

---

<div align="center">

**Made with ❤️ for DevOps**

[⬆ Nach oben](#-panoptic)

</div>
