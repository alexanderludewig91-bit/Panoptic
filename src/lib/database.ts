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

// Explicit initialization function for app startup
export async function initializeDatabase(): Promise<{ success: boolean; error?: string }> {
  try {
    console.log("Initializing database...");
    
    // This will create directory, db file, and tables if needed
    const database = await getDatabase();
    
    // Verify tables exist by running a simple query
    await database.select("SELECT COUNT(*) as count FROM settings");
    
    console.log("Database initialized successfully");
    return { success: true };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("Database initialization failed:", errorMessage);
    return { success: false, error: errorMessage };
  }
}

// Check if a database exists at the given path
export async function databaseExistsAt(path: string): Promise<boolean> {
  try {
    const { exists } = await import("@tauri-apps/plugin-fs");
    const dbFile = `${path}/panoptic.db`;
    return await exists(dbFile);
  } catch {
    return false;
  }
}

// Get info about a database at a specific path (without switching to it)
export async function getDatabaseInfoAt(path: string): Promise<{
  path: string;
  exists: boolean;
  secretsCount: number;
  settingsCount: number;
}> {
  try {
    const { exists } = await import("@tauri-apps/plugin-fs");
    const dbFile = `${path}/panoptic.db`;
    const dbExists = await exists(dbFile);
    
    if (!dbExists) {
      return { path, exists: false, secretsCount: 0, settingsCount: 0 };
    }
    
    // Open temporary connection to the target database
    const Database = (await import("@tauri-apps/plugin-sql")).default;
    const tempDb = await Database.load(`sqlite:${dbFile}`);
    
    try {
      const secrets = await tempDb.select<{ count: number }[]>(
        "SELECT COUNT(*) as count FROM secrets"
      );
      const settings = await tempDb.select<{ count: number }[]>(
        "SELECT COUNT(*) as count FROM settings"
      );
      
      await tempDb.close();
      
      return {
        path,
        exists: true,
        secretsCount: secrets[0]?.count || 0,
        settingsCount: settings[0]?.count || 0,
      };
    } catch (queryError) {
      // Database exists but might not have tables yet
      await tempDb.close();
      return { path, exists: true, secretsCount: 0, settingsCount: 0 };
    }
  } catch (error) {
    console.error("Error getting database info at path:", error);
    return { path, exists: false, secretsCount: 0, settingsCount: 0 };
  }
}

// Get info about current database
export async function getDatabaseInfo(): Promise<{
  path: string;
  exists: boolean;
  secretsCount: number;
  settingsCount: number;
}> {
  try {
    const path = await getDataPath();
    const dbExists = await databaseExistsAt(path);
    
    if (!dbExists) {
      return { path, exists: false, secretsCount: 0, settingsCount: 0 };
    }
    
    const database = await getDatabase();
    const secrets = await database.select<{ count: number }[]>(
      "SELECT COUNT(*) as count FROM secrets"
    );
    const settings = await database.select<{ count: number }[]>(
      "SELECT COUNT(*) as count FROM settings"
    );
    
    return {
      path,
      exists: true,
      secretsCount: secrets[0]?.count || 0,
      settingsCount: settings[0]?.count || 0,
    };
  } catch (error) {
    console.error("Error getting database info:", error);
    const path = await getDataPath();
    return { path, exists: false, secretsCount: 0, settingsCount: 0 };
  }
}

// Switch to an existing database at a different location (no migration)
export async function switchToExistingDatabase(
  newPath: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const { exists } = await import("@tauri-apps/plugin-fs");
    const dbFile = `${newPath}/panoptic.db`;
    
    // Verify the database exists
    const dbExists = await exists(dbFile);
    if (!dbExists) {
      return { success: false, error: "Keine Datenbank am Zielort gefunden." };
    }
    
    // Close current database connection
    await closeDatabase();
    
    // Update the stored path
    localStorage.setItem("panoptic_data_path", newPath);
    
    // Verify we can open the new database
    const database = await getDatabase();
    await database.select("SELECT 1");
    
    console.log("Switched to existing database at:", newPath);
    return { success: true };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("Failed to switch database:", errorMessage);
    return { success: false, error: errorMessage };
  }
}

// Migrate database to a new location
export async function migrateDatabase(
  newPath: string,
  options: { overwrite?: boolean } = {}
): Promise<{ success: boolean; error?: string; migrated: boolean }> {
  try {
    const { exists, mkdir, copyFile } = await import("@tauri-apps/plugin-fs");
    
    const currentPath = await getDataPath();
    const currentDbFile = `${currentPath}/panoptic.db`;
    const newDbFile = `${newPath}/panoptic.db`;
    
    console.log(`Migrating database from ${currentPath} to ${newPath}`);
    
    // Check if source database exists
    const sourceExists = await exists(currentDbFile);
    if (!sourceExists) {
      console.log("No existing database to migrate, will create new at destination");
      return { success: true, migrated: false };
    }
    
    // Check if destination already has a database
    const destExists = await exists(newDbFile);
    if (destExists && !options.overwrite) {
      return { 
        success: false, 
        error: "Am Zielort existiert bereits eine Datenbank. Bitte 'Überschreiben' wählen oder einen anderen Ordner.",
        migrated: false 
      };
    }
    
    // Close current database connection
    await closeDatabase();
    
    // Ensure destination directory exists
    const destDirExists = await exists(newPath);
    if (!destDirExists) {
      await mkdir(newPath, { recursive: true });
      console.log("Created destination directory:", newPath);
    }
    
    // Copy database file
    await copyFile(currentDbFile, newDbFile);
    console.log("Database file copied successfully");
    
    // Also copy any related files (WAL, SHM for SQLite)
    const walFile = `${currentPath}/panoptic.db-wal`;
    const shmFile = `${currentPath}/panoptic.db-shm`;
    
    if (await exists(walFile)) {
      await copyFile(walFile, `${newPath}/panoptic.db-wal`);
    }
    if (await exists(shmFile)) {
      await copyFile(shmFile, `${newPath}/panoptic.db-shm`);
    }
    
    // Update the stored path
    localStorage.setItem("panoptic_data_path", newPath);
    
    // Optionally remove old database (keep for safety)
    // await remove(currentDbFile);
    
    console.log("Database migration completed successfully");
    return { success: true, migrated: true };
    
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("Database migration failed:", errorMessage);
    return { success: false, error: errorMessage, migrated: false };
  }
}
