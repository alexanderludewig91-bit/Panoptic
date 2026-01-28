import { getDatabase, generateId } from "./database";
import { logAudit } from "./audit";

export interface Secret {
  id: string;
  name: string;
  category: "llm" | "infrastructure" | "app";
  provider: string;
  value: string;
  createdAt: Date;
  rotatedAt?: Date;
  lastUsedAt?: Date;
}

interface SecretRow {
  id: string;
  name: string;
  category: string;
  provider: string;
  value: string;
  created_at: number;
  rotated_at: number | null;
  last_used_at: number | null;
}

function rowToSecret(row: SecretRow): Secret {
  return {
    id: row.id,
    name: row.name,
    category: row.category as Secret["category"],
    provider: row.provider,
    value: row.value,
    createdAt: new Date(row.created_at * 1000),
    rotatedAt: row.rotated_at ? new Date(row.rotated_at * 1000) : undefined,
    lastUsedAt: row.last_used_at ? new Date(row.last_used_at * 1000) : undefined,
  };
}

export async function getAllSecrets(): Promise<Secret[]> {
  const db = await getDatabase();
  const rows = await db.select<SecretRow[]>(
    "SELECT * FROM secrets ORDER BY created_at DESC"
  );
  return rows.map(rowToSecret);
}

export async function getSecretById(id: string): Promise<Secret | null> {
  const db = await getDatabase();
  const rows = await db.select<SecretRow[]>(
    "SELECT * FROM secrets WHERE id = ?",
    [id]
  );
  if (rows.length === 0) return null;

  // Update last_used_at
  await db.execute(
    "UPDATE secrets SET last_used_at = unixepoch() WHERE id = ?",
    [id]
  );

  await logAudit("secret_accessed", "secret", id, { name: rows[0].name });
  return rowToSecret(rows[0]);
}

export async function getSecretsByCategory(
  category: Secret["category"]
): Promise<Secret[]> {
  const db = await getDatabase();
  const rows = await db.select<SecretRow[]>(
    "SELECT * FROM secrets WHERE category = ? ORDER BY created_at DESC",
    [category]
  );
  return rows.map(rowToSecret);
}

export async function getSecretsByProvider(provider: string): Promise<Secret[]> {
  const db = await getDatabase();
  // Case-insensitive search using LOWER()
  const rows = await db.select<SecretRow[]>(
    "SELECT * FROM secrets WHERE LOWER(provider) = LOWER(?) ORDER BY created_at DESC",
    [provider]
  );
  return rows.map(rowToSecret);
}

export async function createSecret(
  data: Omit<Secret, "id" | "createdAt" | "rotatedAt" | "lastUsedAt">
): Promise<Secret> {
  const db = await getDatabase();
  const id = generateId();
  
  // Normalize provider to lowercase for consistency
  const normalizedProvider = data.provider.toLowerCase();

  await db.execute(
    `INSERT INTO secrets (id, name, category, provider, value) 
     VALUES (?, ?, ?, ?, ?)`,
    [id, data.name, data.category, normalizedProvider, data.value]
  );

  await logAudit("secret_created", "secret", id, {
    name: data.name,
    category: data.category,
    provider: data.provider,
  });

  const created = await getSecretById(id);
  if (!created) throw new Error("Failed to create secret");
  return created;
}

export async function updateSecret(
  id: string,
  data: Partial<Pick<Secret, "name" | "category" | "provider" | "value">>
): Promise<Secret> {
  const db = await getDatabase();

  const updates: string[] = [];
  const values: (string | number)[] = [];

  if (data.name !== undefined) {
    updates.push("name = ?");
    values.push(data.name);
  }
  if (data.category !== undefined) {
    updates.push("category = ?");
    values.push(data.category);
  }
  if (data.provider !== undefined) {
    updates.push("provider = ?");
    values.push(data.provider.toLowerCase()); // Normalize to lowercase
  }
  if (data.value !== undefined) {
    updates.push("value = ?");
    updates.push("rotated_at = unixepoch()");
    values.push(data.value);
  }

  if (updates.length === 0) {
    const existing = await getSecretById(id);
    if (!existing) throw new Error("Secret not found");
    return existing;
  }

  values.push(id);
  await db.execute(
    `UPDATE secrets SET ${updates.join(", ")} WHERE id = ?`,
    values
  );

  await logAudit("secret_updated", "secret", id, { fields: Object.keys(data) });

  const updated = await getSecretById(id);
  if (!updated) throw new Error("Secret not found");
  return updated;
}

export async function deleteSecret(id: string): Promise<void> {
  const db = await getDatabase();

  // Get secret info for audit log before deletion
  const rows = await db.select<SecretRow[]>(
    "SELECT * FROM secrets WHERE id = ?",
    [id]
  );

  if (rows.length > 0) {
    await db.execute("DELETE FROM secrets WHERE id = ?", [id]);
    await logAudit("secret_deleted", "secret", id, {
      name: rows[0].name,
      provider: rows[0].provider,
    });
  }
}

export async function searchSecrets(query: string): Promise<Secret[]> {
  const db = await getDatabase();
  const searchTerm = `%${query.toLowerCase()}%`;
  const rows = await db.select<SecretRow[]>(
    `SELECT * FROM secrets 
     WHERE LOWER(name) LIKE ? OR LOWER(provider) LIKE ?
     ORDER BY created_at DESC`,
    [searchTerm, searchTerm]
  );
  return rows.map(rowToSecret);
}
