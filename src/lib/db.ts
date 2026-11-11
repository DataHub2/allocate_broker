import { mkdirSync } from "node:fs";
import { join } from "node:path";

export interface Db {
  query<T = Record<string, unknown>>(text: string, params?: unknown[]): Promise<T[]>;
  tx<T>(fn: (db: Db) => Promise<T>): Promise<T>;
}

export const schemaSql = `
  create table if not exists users (
    id uuid primary key default gen_random_uuid(),
    email text not null unique,
    password_hash text not null,
    full_name text not null,
    is_admin boolean not null default false,
    created_at timestamptz not null default now()
  );
  create table if not exists sessions (
    token_hash text primary key,
    user_id uuid not null references users(id) on delete cascade,
    expires_at timestamptz not null
  );
  create table if not exists password_resets (
    token_hash text primary key,
    user_id uuid not null references users(id) on delete cascade,
    expires_at timestamptz not null,
    used_at timestamptz
  );
  create table if not exists login_attempts (
    key text not null,
    at timestamptz not null default now()
  );
  create index if not exists login_attempts_key on login_attempts (key, at desc);

  create table if not exists companies (
    id uuid primary key default gen_random_uuid(),
    owner_id uuid not null unique references users(id) on delete cascade,
    name text not null,
    org_number text not null unique,
    description text not null default '',
    trades jsonb not null,
    postal_prefixes jsonb not null,
    el_registration text,
    wetroom_cert text,
    has_f_skatt boolean not null,
    has_insurance boolean not null,
    status text not null default 'pending' check (status in ('pending','approved','suspended')),
    accepting_jobs boolean not null default true,
    min_job_sek int not null default 0,
    created_at timestamptz not null default now()
  );

  -- Holds nothing that identifies the home. Companies only ever see columns from here.
  create table if not exists projects (
    id uuid primary key default gen_random_uuid(),
    customer_id uuid not null references users(id) on delete cascade,
    status text not null default 'draft' check (status in ('draft','questions','brief_ready','published','quoting','awarded','closed','cancelled')),
    title text not null default 'Nytt jobb',
    job_types jsonb not null default '[]',
    housing_type text,
    year_built int,
    postal_prefix text,
    city text,
    desired_start text,
    budget_band text,
    wants_rot boolean,
    readiness text check (readiness in ('ready_to_hire','comparing','price_only')),
    is_decision_maker boolean,
    approval_status text check (approval_status in ('not_needed','approved','pending','not_asked','unknown')),
    financing_status text check (financing_status in ('ready','needs_loan','unknown')),
    price_model text check (price_model in ('fixed','running','either')),
    access jsonb not null default '{}',
    visit_windows jsonb not null default '[]',
    reply_promise_at timestamptz,
    question_round int not null default 0,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    published_at timestamptz
  );
  create index if not exists projects_customer on projects (customer_id, created_at desc);
  create index if not exists projects_status on projects (status);

  -- Free text and contact details. Companies read this only after the customer has chosen them.
  create table if not exists project_private (
    project_id uuid primary key references projects(id) on delete cascade,
    description text not null,
    street_address text,
    postal_code text,
    phone text,
    contact_name text
  );

  create table if not exists files (
    id uuid primary key default gen_random_uuid(),
    project_id uuid not null references projects(id) on delete cascade,
    question_id uuid,
    kind text not null check (kind in ('photo','drawing')),
    mime text not null,
    name text not null,
    size int not null,
    data bytea not null,
    created_at timestamptz not null default now()
  );
  create index if not exists files_project on files (project_id, created_at);

  create table if not exists questions (
    id uuid primary key default gen_random_uuid(),
    project_id uuid not null references projects(id) on delete cascade,
    round int not null,
    position int not null,
    topic text not null,
    trade text,
    requirement_key text,
    label text not null,
    reason text not null,
    measure_help text,
    input_type text not null check (input_type in ('number','text','longtext','single','multi','photo')),
    unit text,
    options jsonb not null default '[]',
    answer jsonb,
    answer_unknown boolean not null default false
  );
  create index if not exists questions_project on questions (project_id, round, position);

  create table if not exists briefs (
    id uuid primary key default gen_random_uuid(),
    project_id uuid not null references projects(id) on delete cascade,
    version int not null,
    content jsonb not null,
    status text not null default 'draft' check (status in ('draft','approved','superseded')),
    approved_at timestamptz,
    created_at timestamptz not null default now(),
    unique (project_id, version)
  );

  create table if not exists matches (
    id uuid primary key default gen_random_uuid(),
    project_id uuid not null references projects(id) on delete cascade,
    company_id uuid not null references companies(id) on delete cascade,
    score int not null,
    reasons jsonb not null,
    trades jsonb not null,
    status text not null default 'invited' check (status in ('invited','viewed','declined','visit_requested','visit_confirmed','quoted','won','lost')),
    decline_reason text,
    outcome_reason text,
    contact_shared boolean not null default false,
    created_at timestamptz not null default now(),
    unique (project_id, company_id)
  );
  create index if not exists matches_company on matches (company_id, created_at desc);

  create table if not exists site_visits (
    id uuid primary key default gen_random_uuid(),
    match_id uuid not null unique references matches(id) on delete cascade,
    slot text not null,
    note text not null default '',
    status text not null default 'requested' check (status in ('requested','confirmed','declined')),
    created_at timestamptz not null default now()
  );

  create table if not exists quotes (
    id uuid primary key default gen_random_uuid(),
    match_id uuid not null unique references matches(id) on delete cascade,
    total_sek int not null,
    labour_sek int not null,
    rot_sek int not null,
    price_model text not null check (price_model in ('fixed','running')),
    start_text text not null,
    duration_text text not null,
    valid_until text not null,
    terms text not null default '',
    items jsonb not null,
    status text not null default 'sent' check (status in ('sent','accepted','declined')),
    created_at timestamptz not null default now()
  );

  create table if not exists ai_runs (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references users(id) on delete cascade,
    project_id uuid references projects(id) on delete set null,
    kind text not null,
    status text not null,
    error text,
    created_at timestamptz not null default now()
  );
  create index if not exists ai_runs_user on ai_runs (user_id, created_at desc);

  create table if not exists settings (
    key text primary key,
    value text not null,
    updated_at timestamptz not null default now()
  );

  -- Supabase serves the public schema over an open API. Only the table owner, which is this site, gets past this.
  alter table users enable row level security;
  alter table sessions enable row level security;
  alter table password_resets enable row level security;
  alter table login_attempts enable row level security;
  alter table companies enable row level security;
  alter table projects enable row level security;
  alter table project_private enable row level security;
  alter table files enable row level security;
  alter table questions enable row level security;
  alter table briefs enable row level security;
  alter table matches enable row level security;
  alter table site_visits enable row level security;
  alter table quotes enable row level security;
  alter table ai_runs enable row level security;
  alter table settings enable row level security;
`;

interface PgliteLike {
  query<T>(text: string, params?: unknown[]): Promise<{ rows: T[] }>;
  exec(text: string): Promise<unknown>;
  transaction<T>(fn: (tx: { query<R>(text: string, params?: unknown[]): Promise<{ rows: R[] }> }) => Promise<T>): Promise<T>;
}

function wrapPglite(pg: PgliteLike): Db {
  return {
    async query<T>(text: string, params: unknown[] = []) {
      return (await pg.query<T>(text, params)).rows;
    },
    tx(fn) {
      return pg.transaction((t) => {
        const inner: Db = {
          async query<R>(text: string, params: unknown[] = []) {
            return (await t.query<R>(text, params)).rows;
          },
          tx: (nested) => nested(inner),
        };
        return fn(inner);
      }) as ReturnType<typeof fn>;
    },
  };
}

/** A throwaway database for tests. */
export async function createMemoryDb(): Promise<Db> {
  const { PGlite } = await import("@electric-sql/pglite");
  const pg = new PGlite();
  await pg.exec(schemaSql);
  return wrapPglite(pg as unknown as PgliteLike);
}

/**
 * DATABASE_URL, or the pooled address a Vercel database integration sets:
 * POSTGRES_URL, or DATABASE_POSTGRES_URL when the integration was given the prefix DATABASE.
 */
export function databaseUrl(): string | null {
  const raw = process.env.DATABASE_URL || process.env.POSTGRES_URL || process.env.DATABASE_POSTGRES_URL;
  if (!raw) return null;
  // Integrations append their own markers, such as supa=, which Postgres rejects as unknown settings.
  const url = new URL(raw);
  for (const key of [...url.searchParams.keys()]) if (key !== "sslmode") url.searchParams.delete(key);
  return url.toString();
}

async function connect(): Promise<Db> {
  const url = databaseUrl();
  if (url) {
    const { default: postgres } = await import("postgres");
    const sql = postgres(url, { prepare: false, max: 3, idle_timeout: 20, connect_timeout: 15 });
    await sql.unsafe(schemaSql);
    type Runner = { unsafe: (text: string, params?: never[]) => PromiseLike<unknown> };
    const wrap = (runner: Runner): Db => {
      const db: Db = {
        async query<T>(text: string, params: unknown[] = []) {
          // The driver JSON-encodes anything bound to a jsonb parameter, and callers already pass encoded JSON.
          const bound = text.replace(/\$(\d+)::jsonb/g, "($$$1::text)::jsonb");
          return (await runner.unsafe(bound, params as never[])) as T[];
        },
        tx: (fn) => (sql.begin((t) => fn(wrap(t as unknown as Runner))) as unknown) as ReturnType<typeof fn>,
      };
      return db;
    };
    return wrap(sql as unknown as Runner);
  }
  if (process.env.NODE_ENV === "production") throw new Error("Databasen är inte kopplad: DATABASE_URL, POSTGRES_URL eller DATABASE_POSTGRES_URL saknas");
  const { PGlite } = await import("@electric-sql/pglite");
  const dir = join(process.cwd(), ".data");
  mkdirSync(dir, { recursive: true });
  const pg = new PGlite(join(dir, "pglite"));
  await pg.exec(schemaSql);
  return wrapPglite(pg as unknown as PgliteLike);
}

const holder = globalThis as unknown as { __allocateDb?: Promise<Db> };

export function getDb(): Promise<Db> {
  holder.__allocateDb ??= connect().catch((error) => {
    holder.__allocateDb = undefined;
    throw error;
  });
  return holder.__allocateDb;
}
