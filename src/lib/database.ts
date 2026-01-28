import Database from "@tauri-apps/plugin-sql";

let db: Database | null = null;

// Database schema
const SCHEMA = `
-- App-Einstellungen
CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at INTEGER DEFAULT (unixepoch())
);

-- Gespeicherte API-Keys
CREATE TABLE IF NOT EXISTS secrets (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  provider TEXT NOT NULL,
  value TEXT NOT NULL,
  created_at INTEGER DEFAULT (unixepoch()),
  rotated_at INTEGER,
  last_used_at INTEGER
);

-- Provider-Konfigurationen
CREATE TABLE IF NOT EXISTS providers (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL,
  name TEXT NOT NULL,
  enabled INTEGER DEFAULT 1,
  config TEXT,
  secret_id TEXT REFERENCES secrets(id),
  created_at INTEGER DEFAULT (unixepoch())
);

-- Gecachte Usage-Daten
CREATE TABLE IF NOT EXISTS usage_cache (
  id TEXT PRIMARY KEY,
  provider_id TEXT NOT NULL,
  date TEXT NOT NULL,
  data TEXT NOT NULL,
  fetched_at INTEGER DEFAULT (unixepoch())
);

-- Audit Log
CREATE TABLE IF NOT EXISTS audit_log (
  id TEXT PRIMARY KEY,
  action TEXT NOT NULL,
  resource_type TEXT,
  resource_id TEXT,
  details TEXT,
  created_at INTEGER DEFAULT (unixepoch())
);

-- Alert-Konfigurationen
CREATE TABLE IF NOT EXISTS alerts (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  type TEXT,
  provider_id TEXT,
  threshold REAL,
  channel TEXT,
  channel_config TEXT,
  enabled INTEGER DEFAULT 1,
  created_at INTEGER DEFAULT (unixepoch())
);

-- Indizes
CREATE INDEX IF NOT EXISTS idx_secrets_category ON secrets(category);
CREATE INDEX IF NOT EXISTS idx_secrets_provider ON secrets(provider);
CREATE INDEX IF NOT EXISTS idx_usage_cache_provider_date ON usage_cache(provider_id, date);
CREATE INDEX IF NOT EXISTS idx_audit_log_created ON audit_log(created_at);
CREATE INDEX IF NOT EXISTS idx_audit_log_action ON audit_log(action);
`;

export async function initializeDataDirectory(): Promise<string> {
  const dataPath = await getDataPath();
  
  try {
    const { exists, mkdir } = await import("@tauri-apps/plugin-fs");
    
    // Check if directory exists
    const dirExists = await exists(dataPath);
    
    if (!dirExists) {
      // Create the directory
      await mkdir(dataPath, { recursive: true });
      console.log("Created data directory:", dataPath);
    }
  } catch (error) {
    console.error("Error creating data directory:", error);
    // Try alternative approach - create via Rust command or use app data dir
  }
  
  return dataPath;
}

export async function getDatabase(): Promise<Database> {
  if (db) return db;

  // Ensure directory exists first
  const dataPath = await initializeDataDirectory();
  
  // Use a simple path for SQLite
  const dbPath = `sqlite:${dataPath}/panoptic.db`;

  console.log("Opening database at:", dbPath);
  
  try {
    db = await Database.load(dbPath);

    // Initialize schema
    await db.execute(SCHEMA);
    
    console.log("Database initialized successfully");
  } catch (error) {
    console.error("Database error:", error);
    throw error;
  }

  return db;
}

export async function getDataPath(): Promise<string> {
  // Try to get from localStorage first (for quick access)
  const cachedPath = localStorage.getItem("panoptic_data_path");
  if (cachedPath) return cachedPath;

  // Default paths based on platform
  try {
    const { appDataDir } = await import("@tauri-apps/api/path");
    
    // Use Tauri's app data directory - this is guaranteed to be writable
    const appData = await appDataDir();
    console.log("Using app data directory:", appData);
    return appData;
  } catch (error) {
    console.error("Error getting app data path:", error);
    // Fallback for development - use current directory
    return "./panoptic-data";
  }
}

export async function setDataPath(path: string): Promise<void> {
  localStorage.setItem("panoptic_data_path", path);
  // Close existing connection so it reopens with new path
  if (db) {
    await db.close();
    db = null;
  }
}

export function generateId(): string {
  return crypto.randomUUID();
}

// Close database connection
export async function closeDatabase(): Promise<void> {
  if (db) {
    await db.close();
    db = null;
  }
}
