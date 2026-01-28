import { getDatabase, setDataPath as setDbPath, getDataPath } from "./database";
import { logAudit, AuditActions } from "./audit";

export interface AppSettings {
  dataPath: string;
  autoLockMinutes: number;
  theme: "dark" | "light" | "system";
  notificationsEnabled: boolean;
  masterPasswordHash?: string;
  setupCompleted: boolean;
}

const DEFAULT_SETTINGS: AppSettings = {
  dataPath: "",
  autoLockMinutes: 5,
  theme: "dark",
  notificationsEnabled: true,
  setupCompleted: false,
};

export async function getSetting<K extends keyof AppSettings>(
  key: K
): Promise<AppSettings[K]> {
  try {
    const db = await getDatabase();
    const rows = await db.select<{ value: string }[]>(
      "SELECT value FROM settings WHERE key = ?",
      [key]
    );

    if (rows.length === 0) {
      return DEFAULT_SETTINGS[key];
    }

    // Parse JSON for complex types
    const value = rows[0].value;
    try {
      return JSON.parse(value);
    } catch {
      return value as AppSettings[K];
    }
  } catch {
    return DEFAULT_SETTINGS[key];
  }
}

export async function setSetting<K extends keyof AppSettings>(
  key: K,
  value: AppSettings[K]
): Promise<void> {
  const db = await getDatabase();
  const stringValue =
    typeof value === "string" ? value : JSON.stringify(value);

  await db.execute(
    `INSERT INTO settings (key, value, updated_at) 
     VALUES (?, ?, unixepoch())
     ON CONFLICT(key) DO UPDATE SET value = ?, updated_at = unixepoch()`,
    [key, stringValue, stringValue]
  );

  await logAudit(AuditActions.SETTINGS_UPDATED, "settings", key, {
    newValue: value,
  });
}

export async function getAllSettings(): Promise<AppSettings> {
  const settings = { ...DEFAULT_SETTINGS };

  try {
    const db = await getDatabase();
    const rows = await db.select<{ key: string; value: string }[]>(
      "SELECT key, value FROM settings"
    );

    for (const row of rows) {
      const key = row.key as keyof AppSettings;
      try {
        (settings as Record<string, unknown>)[key] = JSON.parse(row.value);
      } catch {
        (settings as Record<string, unknown>)[key] = row.value;
      }
    }
  } catch {
    // Return defaults on error
  }

  // Always get actual data path
  settings.dataPath = await getDataPath();

  return settings;
}

export async function updateDataPath(newPath: string): Promise<void> {
  const oldPath = await getDataPath();

  await setDbPath(newPath);
  await setSetting("dataPath", newPath);

  await logAudit(AuditActions.DATA_PATH_CHANGED, "settings", "dataPath", {
    oldPath,
    newPath,
  });
}

export async function isSetupCompleted(): Promise<boolean> {
  try {
    return await getSetting("setupCompleted");
  } catch {
    return false;
  }
}

export async function completeSetup(): Promise<void> {
  await setSetting("setupCompleted", true);
}

// Simple password hashing (in production, use a proper KDF like Argon2)
export async function hashPassword(password: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(password + "panoptic-salt-v1");
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

export async function verifyPassword(password: string): Promise<boolean> {
  const storedHash = await getSetting("masterPasswordHash");
  if (!storedHash) {
    // No password set yet - first time setup
    return true;
  }

  const inputHash = await hashPassword(password);
  return inputHash === storedHash;
}

export async function setMasterPassword(password: string): Promise<void> {
  const hash = await hashPassword(password);
  await setSetting("masterPasswordHash", hash);
}
