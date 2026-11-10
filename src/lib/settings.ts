import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { databaseUrl, type Db } from "./db";

/**
 * Secrets the admin pastes into the site, such as the AI key, are stored encrypted.
 * A copy of the database alone is then not enough to read them.
 */
function masterKey(): Buffer {
  const base = process.env.SETTINGS_KEY || databaseUrl() || localSecret();
  return createHash("sha256").update(`allocate-settings:${base}`).digest();
}

function localSecret(): string {
  const dir = join(process.cwd(), ".data");
  const file = join(dir, "settings-secret");
  if (!existsSync(file)) {
    mkdirSync(dir, { recursive: true });
    writeFileSync(file, randomBytes(32).toString("base64"), { mode: 0o600 });
  }
  return readFileSync(file, "utf8");
}

export function encrypt(text: string, key = masterKey()): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const body = Buffer.concat([cipher.update(text, "utf8"), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), body]).toString("base64");
}

export function decrypt(stored: string, key = masterKey()): string | null {
  try {
    const raw = Buffer.from(stored, "base64");
    const decipher = createDecipheriv("aes-256-gcm", key, raw.subarray(0, 12));
    decipher.setAuthTag(raw.subarray(12, 28));
    return Buffer.concat([decipher.update(raw.subarray(28)), decipher.final()]).toString("utf8");
  } catch {
    return null; // Encrypted under another key, for example after DATABASE_URL changed.
  }
}

const cache = new Map<string, { value: string | null; at: number }>();
const CACHE_MS = 30_000;

export async function getSecret(db: Db, name: string): Promise<string | null> {
  const hit = cache.get(name);
  if (hit && Date.now() - hit.at < CACHE_MS) return hit.value;
  const [row] = await db.query<{ value: string }>("select value from settings where key = $1", [name]);
  const value = row ? decrypt(row.value) : null;
  cache.set(name, { value, at: Date.now() });
  return value;
}

export async function hasUnreadableSecret(db: Db, name: string): Promise<boolean> {
  const [row] = await db.query<{ value: string }>("select value from settings where key = $1", [name]);
  return Boolean(row) && decrypt(row.value) === null;
}

export async function setSecret(db: Db, name: string, value: string | null): Promise<void> {
  if (value === null) await db.query("delete from settings where key = $1", [name]);
  else await db.query("insert into settings (key, value) values ($1, $2) on conflict (key) do update set value = excluded.value, updated_at = now()", [name, encrypt(value)]);
  cache.delete(name);
}

export const DEEPSEEK_SECRET = "deepseek_api_key";

/** A key pasted on the admin page wins over one set on the server. */
export async function deepSeekKey(db: Db): Promise<{ key: string; source: "admin" | "server" } | null> {
  const stored = await getSecret(db, DEEPSEEK_SECRET);
  if (stored) return { key: stored, source: "admin" };
  if (process.env.DEEPSEEK_API_KEY) return { key: process.env.DEEPSEEK_API_KEY, source: "server" };
  return null;
}

/** Asks DeepSeek whether the key works. Listing models costs nothing. */
export async function checkDeepSeekKey(key: string): Promise<"ok" | "rejected" | "unreachable"> {
  try {
    const response = await fetch("https://api.deepseek.com/models", { headers: { Authorization: `Bearer ${key}` }, signal: AbortSignal.timeout(15_000) });
    if (response.ok) return "ok";
    return response.status === 401 || response.status === 403 ? "rejected" : "unreachable";
  } catch {
    return "unreachable";
  }
}
