import { getDatabase, generateId } from "./database";

export interface AuditLogEntry {
  id: string;
  action: string;
  resourceType?: string;
  resourceId?: string;
  details?: Record<string, unknown>;
  createdAt: Date;
}

interface AuditLogRow {
  id: string;
  action: string;
  resource_type: string | null;
  resource_id: string | null;
  details: string | null;
  created_at: number;
}

function rowToEntry(row: AuditLogRow): AuditLogEntry {
  return {
    id: row.id,
    action: row.action,
    resourceType: row.resource_type || undefined,
    resourceId: row.resource_id || undefined,
    details: row.details ? JSON.parse(row.details) : undefined,
    createdAt: new Date(row.created_at * 1000),
  };
}

export async function logAudit(
  action: string,
  resourceType?: string,
  resourceId?: string,
  details?: Record<string, unknown>
): Promise<void> {
  try {
    const db = await getDatabase();
    const id = generateId();

    await db.execute(
      `INSERT INTO audit_log (id, action, resource_type, resource_id, details)
       VALUES (?, ?, ?, ?, ?)`,
      [
        id,
        action,
        resourceType || null,
        resourceId || null,
        details ? JSON.stringify(details) : null,
      ]
    );
  } catch (error) {
    // Don't throw on audit failures - just log to console
    console.error("Failed to write audit log:", error);
  }
}

export async function getAuditLog(options?: {
  limit?: number;
  offset?: number;
  action?: string;
  resourceType?: string;
  startDate?: Date;
  endDate?: Date;
}): Promise<AuditLogEntry[]> {
  const db = await getDatabase();

  const conditions: string[] = [];
  const values: (string | number)[] = [];

  if (options?.action) {
    conditions.push("action = ?");
    values.push(options.action);
  }
  if (options?.resourceType) {
    conditions.push("resource_type = ?");
    values.push(options.resourceType);
  }
  if (options?.startDate) {
    conditions.push("created_at >= ?");
    values.push(Math.floor(options.startDate.getTime() / 1000));
  }
  if (options?.endDate) {
    conditions.push("created_at <= ?");
    values.push(Math.floor(options.endDate.getTime() / 1000));
  }

  const whereClause =
    conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

  const limit = options?.limit || 100;
  const offset = options?.offset || 0;

  const rows = await db.select<AuditLogRow[]>(
    `SELECT * FROM audit_log ${whereClause}
     ORDER BY created_at DESC
     LIMIT ? OFFSET ?`,
    [...values, limit, offset]
  );

  return rows.map(rowToEntry);
}

export async function getAuditLogCount(options?: {
  action?: string;
  resourceType?: string;
  startDate?: Date;
  endDate?: Date;
}): Promise<number> {
  const db = await getDatabase();

  const conditions: string[] = [];
  const values: (string | number)[] = [];

  if (options?.action) {
    conditions.push("action = ?");
    values.push(options.action);
  }
  if (options?.resourceType) {
    conditions.push("resource_type = ?");
    values.push(options.resourceType);
  }
  if (options?.startDate) {
    conditions.push("created_at >= ?");
    values.push(Math.floor(options.startDate.getTime() / 1000));
  }
  if (options?.endDate) {
    conditions.push("created_at <= ?");
    values.push(Math.floor(options.endDate.getTime() / 1000));
  }

  const whereClause =
    conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

  const result = await db.select<{ count: number }[]>(
    `SELECT COUNT(*) as count FROM audit_log ${whereClause}`,
    values
  );

  return result[0]?.count || 0;
}

export async function clearOldAuditLogs(daysToKeep: number = 90): Promise<number> {
  const db = await getDatabase();
  const cutoff = Math.floor(Date.now() / 1000) - daysToKeep * 24 * 60 * 60;

  const result = await db.execute(
    "DELETE FROM audit_log WHERE created_at < ?",
    [cutoff]
  );

  return result.rowsAffected;
}

// Pre-defined action types for consistency
export const AuditActions = {
  // Auth
  APP_UNLOCKED: "app_unlocked",
  APP_LOCKED: "app_locked",

  // Secrets
  SECRET_CREATED: "secret_created",
  SECRET_UPDATED: "secret_updated",
  SECRET_DELETED: "secret_deleted",
  SECRET_ACCESSED: "secret_accessed",
  SECRET_COPIED: "secret_copied",

  // Settings
  SETTINGS_UPDATED: "settings_updated",
  DATA_PATH_CHANGED: "data_path_changed",

  // API
  API_CALL: "api_call",
  API_ERROR: "api_error",

  // Export
  DATA_EXPORTED: "data_exported",
} as const;
