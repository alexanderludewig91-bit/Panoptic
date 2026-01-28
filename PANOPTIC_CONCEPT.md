# Panoptic

**"Alles im Blick"** – Eine lokale Desktop-App zur zentralen Überwachung und Steuerung aller Cloud-Ressourcen, API-Kosten und Anwendungen.

> *panoptikos* (griech.) = "alles sehend"

---

## 🎯 Vision

**Ein einziger, hochsicherer Zugangspunkt** für alle deine DevOps-Aktivitäten:

- Keine 10 verschiedenen Dashboards mehr
- Alle API-Kosten auf einen Blick
- Zentrale Verwaltung aller Admin-Keys
- Steuerung deployed Applications
- Erweiterbar nach Bedarf
- **100% lokal** – sensible Daten verlassen nie dein Gerät

---

## 🖥️ Architektur: Lokale Desktop-App

### Warum lokal statt Cloud?

| Aspekt | Cloud-Deployment | Lokale App ✅ |
|--------|------------------|---------------|
| **Datensicherheit** | Secrets auf fremden Servern | Alles auf deinem Gerät |
| **Angriffsfläche** | Öffentlicher Endpunkt | Kein Netzwerk-Zugriff von außen |
| **Kosten** | Vercel/Railway Hosting | Kostenlos |
| **Authentifizierung** | WebAuthn + IP-Allowlist | Native Biometrie (Touch ID / Windows Hello) |
| **Offline-Nutzung** | ❌ | ✅ (außer für API-Calls) |

### Tech Stack

```
┌─────────────────────────────────────────┐
│         Panoptic Desktop App            │
├─────────────────────────────────────────┤
│  Frontend: React 19 + TypeScript        │
│            Tailwind CSS + shadcn/ui     │
│            (WebView, kein Chromium)     │
├─────────────────────────────────────────┤
│  Backend:  Tauri 2.0 (Rust)             │
│            ├── Biometric Auth Plugin    │
│            ├── SQLite + SQLCipher       │
│            ├── OS Keychain Integration  │
│            └── HTTP Client              │
├─────────────────────────────────────────┤
│  Plattformen: macOS, Windows, Linux     │
│  Bundle Size: ~10-15 MB                 │
└─────────────────────────────────────────┘
```

### Datei-Struktur

```
App Installation:
├── macOS:    /Applications/Panoptic.app
├── Windows:  C:\Program Files\Panoptic\
└── Linux:    ~/.local/share/Panoptic/

Daten (wählbar, Standard: OneDrive für Sync):
~/OneDrive/Panoptic/
├── panoptic.db          # SQLite DB (AES-256 verschlüsselt)
├── config.json          # App-Einstellungen
└── backups/             # Automatische Backups
    ├── panoptic_2026-01-27.db
    └── ...
```

---

## 🔄 Multi-Device Sync (OneDrive)

### Konzept

Die App wird **lokal installiert**, aber die **Datenbank liegt in OneDrive** für automatischen Sync.

```
┌─────────────────────────────────────────────────────────────┐
│                        Gerät 1 (Mac)                        │
├─────────────────────────────────────────────────────────────┤
│  /Applications/Panoptic.app        ← App installiert        │
│                                                             │
│  ~/OneDrive/Panoptic/                                       │
│    └── panoptic.db                 ← SQLite DB (encrypted)  │
└─────────────────────────────────────────────────────────────┘
                            │
                            │ OneDrive Sync ☁️
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                     Gerät 2 (Windows)                       │
├─────────────────────────────────────────────────────────────┤
│  C:\Program Files\Panoptic\        ← App installiert        │
│                                                             │
│  C:\Users\...\OneDrive\Panoptic\                            │
│    └── panoptic.db                 ← Gleiche DB, gesynct    │
└─────────────────────────────────────────────────────────────┘
```

### Konflikt-Handling

| Szenario | Lösung |
|----------|--------|
| **DB auf anderem Gerät offen** | Lock-File Check → Warnung mit Read-Only Option |
| **Offline-Änderungen auf beiden Geräten** | OneDrive Konflikt-Datei → Merge-Dialog in App |
| **Normaler Workflow** | App schließen → Sync → App auf anderem Gerät öffnen |

### Unterstützte Sync-Provider

- **OneDrive** (empfohlen für Windows-Nutzer)
- **iCloud Drive** (empfohlen für Mac-only)
- **Dropbox**
- **Lokaler Ordner** (kein Sync)

---

## 🔐 Sicherheitskonzept

### Authentifizierung: Native Biometrie

| Plattform | Methode | Fallback |
|-----------|---------|----------|
| **macOS** | Touch ID | Passwort |
| **Windows** | Windows Hello (Fingerprint/Face/PIN) | Passwort |
| **Linux** | Passwort | – |

### Verschlüsselung

```
┌─────────────────────────────────────────────────────────────┐
│                    Encryption Flow                          │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Biometrie ────► OS Keychain ────► Master Key               │
│      │               │                  │                   │
│      │          (sicher gespeichert,    │                   │
│      │           pro Gerät)             ▼                   │
│      │                           ┌─────────────┐            │
│      │                           │  SQLCipher  │            │
│      │                           │  AES-256    │            │
│      │                           └──────┬──────┘            │
│      │                                  │                   │
│      │                                  ▼                   │
│      │                           panoptic.db                │
│      │                           (verschlüsselt)            │
│      │                                  │                   │
│      │                                  ▼                   │
│      │                            OneDrive Sync             │
│      │                                                      │
│      └──► Ohne Biometrie/Passwort: Keine Entschlüsselung   │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### Sicherheitsmaßnahmen

- **Encrypted at Rest**: SQLite-DB vollständig verschlüsselt (SQLCipher/AES-256)
- **Key im OS Keychain**: Master-Key nie im Dateisystem, nur im sicheren OS-Speicher
- **Auto-Lock**: App sperrt nach X Minuten Inaktivität
- **No Plain-Text Secrets**: API-Keys werden nie im Klartext angezeigt
- **Audit-Log**: Jede Aktion wird protokolliert
- **Secure Memory**: Rust/Tauri = memory-safe, keine Buffer Overflows

### Disaster Recovery

| Szenario | Lösung |
|----------|--------|
| **Biometrie funktioniert nicht** | Passwort-Fallback |
| **Passwort vergessen** | Recovery-Phrase (24 Wörter, beim Setup generiert) |
| **Gerät verloren** | Neues Gerät + OneDrive Sync + Recovery-Phrase |
| **DB korrupt** | Automatische Backups im OneDrive-Ordner |

---

## 📊 Module & Features

### Modul 1: LLM Cost Tracker (MVP)

Aggregierte Ansicht der API-Kosten aller LLM-Provider.

#### Unterstützte Provider

| Provider | API | Daten |
|----------|-----|-------|
| **OpenAI** | Usage API (`/v1/organization/usage/*`) | Tokens, Kosten/Tag, pro Modell |
| **Anthropic** | Usage API (`/v1/organizations/{org}/usage`) | Tokens, Kosten |
| **Google (Gemini)** | Cloud Billing API | Kosten, Quotas |

#### Features

- [ ] Dashboard mit Gesamtkosten (heute, Woche, Monat)
- [ ] Kosten pro Provider (Pie Chart)
- [ ] Kosten-Trend (Line Chart, 30 Tage)
- [ ] Breakdown nach Modell (GPT-4o vs Claude 3.5 etc.)
- [ ] Schwellenwert-Alerts (z.B. "Warnung bei >$50/Tag")
- [ ] CSV/JSON Export

---

### Modul 2: Infrastructure Monitor

Status und Metriken deiner Cloud-Infrastruktur.

#### Unterstützte Services

| Service | API | Daten |
|---------|-----|-------|
| **Railway** | GraphQL API | Deployments, Logs, Ressourcen |
| **Vercel** | REST API | Deployments, Domains, Bandwidth |
| **NeonDB** | REST API | Databases, Connections, Storage |
| **Supabase** | Management API | Projects, DB Stats, Auth Users |
| **Cloudflare** | REST API | DNS, Analytics, Workers |

#### Features

- [ ] Service-Status-Übersicht (🟢 Online / 🔴 Offline)
- [ ] Deployment-History
- [ ] Ressourcen-Verbrauch (CPU, RAM, Storage)
- [ ] Quick Actions: Redeploy, Restart, Scale
- [ ] Logs-Viewer (Live-Tail)

---

### Modul 3: App User Management

Zentrale Benutzerverwaltung für deine deployed Applications.

#### Features

- [ ] Liste aller User pro App
- [ ] Letzter Login, Registrierungsdatum
- [ ] User aktivieren/deaktivieren
- [ ] Passwort-Reset auslösen
- [ ] User-Suche (Name, Email)
- [ ] Bulk-Aktionen

#### Integration

Erfordert, dass deine Apps eine Admin-API exponieren oder eine gemeinsame Auth-Lösung nutzen (z.B. Supabase Auth, Auth0, Clerk).

---

### Modul 4: Secrets Vault

Sichere Verwaltung aller API-Keys und Credentials.

#### Features

- [ ] Verschlüsselte Speicherung (in SQLCipher DB)
- [ ] Kategorisierung (LLM, Infrastructure, Apps, ...)
- [ ] Rotations-Reminder ("Key ist 90 Tage alt")
- [ ] Copy-to-Clipboard (temporär, 30 Sekunden, dann gelöscht)
- [ ] Nie Klartext in Logs oder UI
- [ ] Import/Export (verschlüsselt)

---

### Modul 5: Alerts & Notifications

Proaktive Benachrichtigungen bei wichtigen Events.

#### Alert-Typen

- **Cost Alerts**: "OpenAI Kosten heute >$50"
- **Status Alerts**: "Railway Service XY ist offline"
- **Quota Alerts**: "NeonDB Storage bei 80%"

#### Kanäle

- [ ] System Notifications (native macOS/Windows)
- [ ] Email (optional)
- [ ] Telegram Bot (optional)
- [ ] Discord Webhook (optional)

---

### Modul 6: Audit Log

Vollständige Nachvollziehbarkeit aller Aktionen.

#### Erfasste Events

- App-Starts / Unlocks
- API-Key Zugriffe (welcher Key wurde wann verwendet)
- Konfigurationsänderungen
- User-Management Aktionen
- Export-Vorgänge

#### Features

- [ ] Filterable Log-Ansicht
- [ ] Retention Policy (z.B. 90 Tage)
- [ ] Export für Review

---

## 📐 Datenmodell (SQLite)

```sql
-- App-Einstellungen
CREATE TABLE settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at INTEGER DEFAULT (unixepoch())
);

-- Gespeicherte API-Keys (Werte bereits durch SQLCipher verschlüsselt)
CREATE TABLE secrets (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  category TEXT, -- 'llm', 'infrastructure', 'app', ...
  provider TEXT, -- 'openai', 'anthropic', 'railway', ...
  value TEXT NOT NULL, -- durch DB-Verschlüsselung geschützt
  created_at INTEGER DEFAULT (unixepoch()),
  rotated_at INTEGER,
  last_used_at INTEGER
);

-- Provider-Konfigurationen
CREATE TABLE providers (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL, -- 'llm', 'infrastructure', 'app'
  name TEXT NOT NULL, -- 'openai', 'railway', etc.
  enabled INTEGER DEFAULT 1,
  config TEXT, -- JSON für provider-spezifische Settings
  secret_id TEXT REFERENCES secrets(id),
  created_at INTEGER DEFAULT (unixepoch())
);

-- Gecachte Usage-Daten (für Offline-Ansicht)
CREATE TABLE usage_cache (
  id TEXT PRIMARY KEY,
  provider_id TEXT REFERENCES providers(id),
  date TEXT NOT NULL, -- 'YYYY-MM-DD'
  data TEXT NOT NULL, -- JSON mit Usage-Daten
  fetched_at INTEGER DEFAULT (unixepoch())
);

-- Audit Log
CREATE TABLE audit_log (
  id TEXT PRIMARY KEY,
  action TEXT NOT NULL,
  resource_type TEXT,
  resource_id TEXT,
  details TEXT, -- JSON
  created_at INTEGER DEFAULT (unixepoch())
);

-- Alert-Konfigurationen
CREATE TABLE alerts (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  type TEXT, -- 'cost', 'status', 'quota', ...
  provider_id TEXT REFERENCES providers(id),
  threshold REAL,
  channel TEXT, -- 'system', 'email', 'telegram', ...
  channel_config TEXT, -- JSON
  enabled INTEGER DEFAULT 1,
  created_at INTEGER DEFAULT (unixepoch())
);

-- Indizes
CREATE INDEX idx_secrets_category ON secrets(category);
CREATE INDEX idx_secrets_provider ON secrets(provider);
CREATE INDEX idx_usage_cache_provider_date ON usage_cache(provider_id, date);
CREATE INDEX idx_audit_log_created ON audit_log(created_at);
CREATE INDEX idx_audit_log_action ON audit_log(action);
```

---

## 🚀 MVP Definition

### Scope für V0.1

**Nur das Wichtigste, um Wert zu liefern:**

1. ✅ **Auth**: Touch ID / Windows Hello / Passwort
2. ✅ **Secrets Vault**: Sichere Speicherung der API-Keys
3. ✅ **LLM Costs**: OpenAI Usage Dashboard
4. ✅ **Audit**: Basic Logging
5. ✅ **OneDrive Sync**: Datenbank-Pfad wählbar

### Nicht im MVP

- ❌ Anthropic/Gemini Integration (V0.2)
- ❌ Infrastructure Monitor (V0.3)
- ❌ App User Management (V0.4)
- ❌ Alerts & Notifications (V0.5)

---

## 📅 Roadmap

### Phase 1: Foundation (MVP)

- [ ] Tauri 2.0 + React Projekt-Setup
- [ ] Biometrische Authentifizierung
- [ ] SQLCipher Datenbank (verschlüsselt)
- [ ] Secrets-Vault UI
- [ ] Datenpfad-Auswahl (OneDrive Support)
- [ ] OpenAI Usage API Integration
- [ ] Basic Dashboard UI
- [ ] Audit Logging

### Phase 2: LLM Complete

- [ ] Anthropic Usage Integration
- [ ] Google Cloud Billing Integration
- [ ] Aggregierte Kosten-Ansicht
- [ ] Charts & Trends (Recharts)
- [ ] Cost Alerts

### Phase 3: Infrastructure

- [ ] Railway Integration
- [ ] Vercel Integration
- [ ] NeonDB Integration
- [ ] Status-Dashboard
- [ ] Quick Actions

### Phase 4: App Management

- [ ] Generic User-API Schema
- [ ] Erste App-Integration
- [ ] User-Liste & Aktionen

### Phase 5: Polish

- [ ] Auto-Updater
- [ ] Keyboard Shortcuts
- [ ] Export-Funktionen
- [ ] Dark/Light Mode Toggle

---

## 🔌 API-Referenzen

### OpenAI Usage API

```bash
# Admin Key erstellen: platform.openai.com/settings/organization/admin-keys

# Completions Usage (letzte 7 Tage)
curl "https://api.openai.com/v1/organization/usage/completions?start_time=$(date -v-7d +%s)&bucket_width=1d" \
  -H "Authorization: Bearer $OPENAI_ADMIN_KEY"

# Costs
curl "https://api.openai.com/v1/organization/costs?start_time=$(date -v-7d +%s)&bucket_width=1d" \
  -H "Authorization: Bearer $OPENAI_ADMIN_KEY"
```

### Anthropic Usage API

```bash
# API Key mit Admin-Rechten erforderlich
curl "https://api.anthropic.com/v1/organizations/{org_id}/usage" \
  -H "x-api-key: $ANTHROPIC_API_KEY" \
  -H "anthropic-version: 2024-01-01"
```

### Railway GraphQL API

```bash
# Token erstellen: railway.app/account/tokens

curl "https://backboard.railway.app/graphql/v2" \
  -H "Authorization: Bearer $RAILWAY_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"query": "{ me { projects { edges { node { name } } } } }"}'
```

### Vercel API

```bash
# Token erstellen: vercel.com/account/tokens

curl "https://api.vercel.com/v9/projects" \
  -H "Authorization: Bearer $VERCEL_TOKEN"
```

### NeonDB API

```bash
# API Key erstellen: console.neon.tech/app/settings/api-keys

curl "https://console.neon.tech/api/v2/projects" \
  -H "Authorization: Bearer $NEON_API_KEY"
```

---

## 🎨 UI/UX Konzept

### Design-Prinzipien

- **Dark Mode First**: Angenehm für lange Sessions
- **Information Density**: Viele Daten auf einen Blick, aber nicht überladen
- **Quick Actions**: Häufige Aktionen mit 1-2 Klicks erreichbar
- **Keyboard-First**: Power-User können alles mit Shortcuts erreichen

### Inspiration

- **Raycast**: Schnelle, keyboard-driven UI
- **Linear**: Clean, modernes Design
- **1Password**: Secrets-Management UX
- **Vercel Dashboard**: Minimalistisch, gute Datenvisualisierung

### Farbschema (Dark Mode)

```css
--background: #0a0a0a;
--card: #141414;
--border: #262626;
--text-primary: #fafafa;
--text-secondary: #a1a1a1;
--accent: #3b82f6; /* Blue */
--success: #22c55e;
--warning: #eab308;
--danger: #ef4444;
```

---

## 📝 Nächste Schritte

1. ✅ Konzept finalisiert
2. **Tauri 2.0 Projekt initialisieren**
3. Biometric Auth Plugin einrichten
4. SQLCipher Integration
5. Basic UI mit shadcn/ui
6. Secrets Vault implementieren
7. OpenAI Integration

---

*Erstellt: 27.01.2026*
*Aktualisiert: 27.01.2026*
*Status: Bereit für Entwicklung*
