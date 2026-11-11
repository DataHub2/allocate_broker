import { randomBytes } from "node:crypto";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { createMemoryDb, type Db } from "@/lib/db";
import { decrypt, deepSeekKey, DEEPSEEK_SECRET, encrypt, setSecret } from "@/lib/settings";

let db: Db;
// A key in the environment would otherwise answer for the database.
vi.stubEnv("DEEPSEEK_API_KEY", "");
afterAll(() => vi.unstubAllEnvs());
beforeEach(async () => { db = await createMemoryDb(); });

describe("sparade nycklar", () => {
  it("stores the key encrypted, never as written", async () => {
    await setSecret(db, DEEPSEEK_SECRET, "sk-test-1234567890abcdef");
    const [row] = await db.query<{ value: string }>("select value from settings where key = $1", [DEEPSEEK_SECRET]);
    expect(row.value).not.toContain("sk-test");
    expect((await deepSeekKey(db))?.key).toBe("sk-test-1234567890abcdef");
  });

  it("cannot be read with another master key", () => {
    const stored = encrypt("hemlig", randomBytes(32));
    expect(decrypt(stored, randomBytes(32))).toBeNull();
  });

  it("forgets the key when it is removed", async () => {
    await setSecret(db, DEEPSEEK_SECRET, "sk-test-1234567890abcdef");
    await setSecret(db, DEEPSEEK_SECRET, null);
    expect(await deepSeekKey(db)).toBeNull();
  });
});

describe("databasadress", async () => {
  const { databaseUrl } = await import("@/lib/db");
  it("drops integration markers that Postgres would reject", () => {
    vi.stubEnv("DATABASE_URL", "");
    vi.stubEnv("POSTGRES_URL", "postgres://u:p@host:6543/postgres?sslmode=require&supa=base-pooler.x");
    expect(databaseUrl()).toBe("postgres://u:p@host:6543/postgres?sslmode=require");
  });

  it("finds the address when the integration was given a prefix", () => {
    vi.stubEnv("DATABASE_URL", "");
    vi.stubEnv("POSTGRES_URL", "");
    vi.stubEnv("DATABASE_POSTGRES_URL", "postgres://u:p@host:6543/postgres?sslmode=require");
    expect(databaseUrl()).toBe("postgres://u:p@host:6543/postgres?sslmode=require");
  });
});
