import { z } from "zod";
import { AiFailure, type Ai, type AiJobContext, type AiQuestion } from "./ai";
import { briefSchema, mergeScope, quoteLines, rotDeduction, scrubBrief, scrubText, type Brief } from "./brief";
import type { Db } from "./db";
import { requirementsFor, TRADES, type JobType, type Requirement, type Trade } from "./job-requirements";
import { eligibleTrades, isEligible, isValidOrgNumber, MAX_COMPANIES_PER_TRADE, pickCompanies, scoreCompany, type CandidateCompany, type JobForMatching, type ScoredCompany } from "./matching";

/** A problem the person can act on. The message is shown as written. */
export class UserError extends Error {
  constructor(message: string, readonly fields: Record<string, string> = {}) {
    super(message);
  }
}
export class NotFound extends Error {}

export const LIMITS = { aiPerDay: 30, briefsPerProject: 10, files: 20, drawings: 5, maxFileBytes: 4 * 1024 * 1024 } as const;

export const basicsSchema = z
  .object({
    postal_code: z.string().regex(/^\d{3}\s?\d{2}$/, "Skriv postnumret med fem siffror."),
    city: z.string().trim().min(2, "Skriv orten.").max(80),
    street_address: z.string().trim().min(3, "Skriv gatuadressen.").max(120),
    contact_name: z.string().trim().min(2, "Skriv ditt namn.").max(80),
    phone: z.string().trim().regex(/^[+\d][\d\s-]{6,18}$/, "Skriv ett telefonnummer med siffror."),
    housing_type: z.enum(["villa", "radhus", "bostadsratt", "fritidshus", "annat"], { error: "Välj boendeform." }),
    year_built: z.number().int().min(1600).max(2100).nullable(),
    desired_start: z.string().trim().min(1, "Välj när jobbet ska börja.").max(60),
    budget_band: z.string().trim().max(60).nullable(),
    wants_rot: z.boolean({ error: "Svara på om du vill använda ROT-avdrag." }),
    readiness: z.enum(["ready_to_hire", "comparing", "price_only"], { error: "Välj hur långt du har kommit." }),
    is_decision_maker: z.boolean({ error: "Svara på om du bestämmer själv." }),
    approval_status: z.enum(["not_needed", "approved", "pending", "not_asked", "unknown"]),
    financing_status: z.enum(["ready", "needs_loan", "unknown"], { error: "Svara på om pengarna är klara." }),
    price_model: z.enum(["fixed", "running", "either"], { error: "Välj hur du vill betala." }),
    access: z.object({
      floor: z.string().max(10),
      elevator: z.string().max(10),
      parking: z.string().max(40),
      container: z.string().max(10),
      occupied: z.string().max(10),
      water_wc: z.string().max(10),
      pets: z.string().max(10),
      blocked_hours: z.string().max(200),
    }),
  })
  .refine((v) => v.housing_type !== "bostadsratt" || v.approval_status !== "not_needed", {
    path: ["approval_status"],
    message: "Svara på om föreningen har godkänt arbetet.",
  });
export type BasicsInput = z.infer<typeof basicsSchema>;

interface ProjectRow {
  id: string;
  customer_id: string;
  status: string;
  title: string;
  job_types: JobType[];
  housing_type: string | null;
  year_built: number | null;
  postal_prefix: string | null;
  city: string | null;
  desired_start: string | null;
  budget_band: string | null;
  wants_rot: boolean | null;
  readiness: string | null;
  is_decision_maker: boolean | null;
  approval_status: string | null;
  financing_status: string | null;
  price_model: string | null;
  access: Record<string, string>;
  visit_windows: string[];
  question_round: number;
  published_at: Date | null;
}

interface PrivateRow {
  description: string;
  street_address: string | null;
  postal_code: string | null;
  phone: string | null;
  contact_name: string | null;
}

const COMPANY_COLUMNS_FROM_PROJECT = "p.id, p.status, p.title, p.job_types, p.housing_type, p.year_built, p.city, p.desired_start, p.wants_rot, p.readiness, p.is_decision_maker, p.approval_status, p.financing_status, p.price_model, p.access, p.visit_windows";

// ---------- Ownership ----------

async function ownedProject(db: Db, userId: string, projectId: string): Promise<ProjectRow> {
  if (!isUuid(projectId)) throw new NotFound();
  const [row] = await db.query<ProjectRow>("select * from projects where id = $1 and customer_id = $2", [projectId, userId]);
  if (!row) throw new NotFound();
  return row;
}

export function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}

async function privateFor(db: Db, projectId: string): Promise<PrivateRow> {
  const [row] = await db.query<PrivateRow>("select * from project_private where project_id = $1", [projectId]);
  if (!row) throw new NotFound();
  return row;
}

async function ownedMatch(db: Db, userId: string, matchId: string) {
  if (!isUuid(matchId)) throw new NotFound();
  const [row] = await db.query<{ id: string; project_id: string; status: string; trades: Trade[] }>(
    "select m.id, m.project_id, m.status, m.trades from matches m join projects p on p.id = m.project_id where m.id = $1 and p.customer_id = $2",
    [matchId, userId],
  );
  if (!row) throw new NotFound();
  return row;
}

export interface CompanyRow extends Omit<CandidateCompany, "open_jobs"> {
  owner_id: string;
  org_number: string;
}

export async function companyOf(db: Db, userId: string): Promise<CompanyRow | null> {
  const [row] = await db.query<CompanyRow>("select * from companies where owner_id = $1", [userId]);
  return row ?? null;
}

async function companyMatch(db: Db, userId: string, matchId: string) {
  if (!isUuid(matchId)) throw new NotFound();
  const company = await companyOf(db, userId);
  if (!company || company.status !== "approved") throw new NotFound();
  const [match] = await db.query<{ id: string; project_id: string; status: string; trades: Trade[]; contact_shared: boolean; decline_reason: string | null; outcome_reason: string | null }>(
    "select id, project_id, status, trades, contact_shared, decline_reason, outcome_reason from matches where id = $1 and company_id = $2",
    [matchId, company.id],
  );
  if (!match) throw new NotFound();
  return { company, match };
}

// ---------- AI bookkeeping ----------

async function withAi<T>(db: Db, userId: string, projectId: string, kind: string, message: string, fn: () => Promise<T>): Promise<T> {
  const [{ count }] = await db.query<{ count: number }>(
    "select count(*)::int as count from ai_runs where user_id = $1 and created_at > now() - interval '24 hours'",
    [userId],
  );
  if (count >= LIMITS.aiPerDay) throw new UserError("Du har gjort många försök det senaste dygnet. Det du har skrivit är sparat. Försök igen i morgon.");
  try {
    const result = await fn();
    await db.query("insert into ai_runs (user_id, project_id, kind, status) values ($1, $2, $3, 'ok')", [userId, projectId, kind]);
    return result;
  } catch (error) {
    await db.query("insert into ai_runs (user_id, project_id, kind, status, error) values ($1, $2, $3, 'failed', $4)", [userId, projectId, kind, String(error).slice(0, 500)]);
    if (error instanceof UserError) throw error;
    console.error(`AI ${kind} failed`, error instanceof AiFailure ? error.message : error);
    throw new UserError(message);
  }
}

const HOUSING_LABEL: Record<string, string> = { villa: "Villa", radhus: "Radhus", bostadsratt: "Bostadsrätt", fritidshus: "Fritidshus", annat: "Annat" };

async function jobContext(db: Db, project: ProjectRow, priv: PrivateRow): Promise<AiJobContext> {
  const files = await db.query<{ kind: "photo" | "drawing"; mime: string; data: Uint8Array; task: string | null }>(
    "select f.kind, f.mime, f.data, q.label as task from files f left join questions q on q.id = f.question_id where f.project_id = $1 order by f.created_at",
    [project.id],
  );
  const questions = await db.query<{ label: string; answer: unknown; answer_unknown: boolean; input_type: string }>(
    "select label, answer, answer_unknown, input_type from questions where project_id = $1 and input_type <> 'photo' order by round, position",
    [project.id],
  );
  const facts: Record<string, string> = {
    Boendeform: HOUSING_LABEL[project.housing_type ?? ""] ?? "Okänt",
    Byggår: project.year_built ? String(project.year_built) : "Okänt",
    Ort: project.city ?? "Okänt",
    "Önskad start": project.desired_start ?? "Okänt",
    "Vill använda ROT": project.wants_rot ? "Ja" : "Nej",
    "Betalning": project.price_model ?? "Okänt",
  };
  // Contact details never leave for the AI provider, even if someone typed them into the free text.
  const secrets = secretsOf(priv);
  const answers = questions.map((q) => ({
    label: q.label,
    answer: q.answer_unknown ? "Vet inte" : q.answer === null ? "Inte besvarad" : scrubText(Array.isArray(q.answer) ? q.answer.join(", ") : String(q.answer), secrets),
  }));
  return { description: scrubText(priv.description, secrets), facts, files, answers };
}

// ---------- Customer: creating the job ----------

export async function createProject(db: Db, userId: string, description: string): Promise<string> {
  const text = description.trim();
  if (text.length < 5) throw new UserError("Beskriv jobbet med några ord först.", { description: "Beskriv jobbet med några ord först." });
  if (text.length > 5000) throw new UserError("Beskrivningen får vara högst 5 000 tecken.");
  return db.tx(async (tx) => {
    const [{ id }] = await tx.query<{ id: string }>("insert into projects (customer_id) values ($1) returning id", [userId]);
    await tx.query("insert into project_private (project_id, description) values ($1, $2)", [id, text]);
    return id;
  });
}

export async function saveBasics(db: Db, userId: string, projectId: string, input: BasicsInput): Promise<void> {
  const project = await ownedProject(db, userId, projectId);
  if (project.status !== "draft") throw new UserError("Grundfakta går inte att ändra efter det här steget.");
  const postal = input.postal_code.replace(/\s/g, "");
  await db.tx(async (tx) => {
    await tx.query(
      "update project_private set street_address = $2, postal_code = $3, phone = $4, contact_name = $5 where project_id = $1",
      [projectId, input.street_address, postal, input.phone, input.contact_name],
    );
    await tx.query(
      `update projects set housing_type = $2, year_built = $3::int, postal_prefix = $4, city = $5, desired_start = $6, budget_band = $7,
       wants_rot = $8::boolean, readiness = $9, is_decision_maker = $10::boolean, approval_status = $11, financing_status = $12, price_model = $13,
       access = $14::jsonb, updated_at = now() where id = $1`,
      [projectId, input.housing_type, input.year_built, postal.slice(0, 2), input.city, input.desired_start, input.budget_band, input.wants_rot, input.readiness, input.is_decision_maker, input.approval_status, input.financing_status, input.price_model, JSON.stringify(input.access)],
    );
  });
}

export async function generateQuestions(db: Db, ai: Ai, userId: string, projectId: string): Promise<void> {
  const project = await ownedProject(db, userId, projectId);
  if (project.status !== "draft") return;
  const priv = await privateFor(db, projectId);
  const context = await jobContext(db, project, priv);
  const intake = await withAi(db, userId, projectId, "intake", "Det gick inte att skapa frågorna. Det du har skrivit är sparat. Försök igen.", () => ai.intake(context));
  const requirements = requirementsFor(intake.job_types);
  const prefilled = new Map(intake.prefilled.map((p) => [p.requirement_key, p.value]));
  await db.tx(async (tx) => {
    await tx.query("delete from questions where project_id = $1", [projectId]);
    let position = 0;
    for (const r of requirements) {
      const answer = cleanPrefill(r, prefilled.get(r.key));
      await tx.query(
        `insert into questions (project_id, round, position, topic, trade, requirement_key, label, reason, measure_help, input_type, unit, options, answer)
         values ($1, 1, $2::int, $3, $4, $5, $6, $7, $8, $9, $10, $11::jsonb, $12::jsonb)`,
        [projectId, position++, r.topic, r.trade, r.key, r.label, r.reason, r.measureHelp ?? null, r.inputType, r.unit ?? null, JSON.stringify(r.options ?? []), answer === null ? null : JSON.stringify(answer)],
      );
    }
    await insertAiQuestions(tx, projectId, 1, position, intake.extra_questions.slice(0, 6));
    await tx.query("update projects set status = 'questions', question_round = 1, title = $2, job_types = $3::jsonb, updated_at = now() where id = $1", [projectId, intake.title.slice(0, 120), JSON.stringify(intake.job_types)]);
  });
}

/** AI answers are only kept when they fit the question, so the form can show them. */
export function cleanPrefill(r: Requirement, value: string | undefined): string | null {
  const v = value?.trim();
  if (!v) return null;
  if (r.inputType === "number") return /^\d+([.,]\d+)?$/.test(v) ? v.replace(".", ",") : null;
  if (r.inputType === "single") return r.options?.find((o) => o.toLowerCase() === v.toLowerCase()) ?? null;
  if (r.inputType === "text" || r.inputType === "longtext") return v.slice(0, 500);
  return null;
}

async function insertAiQuestions(tx: Db, projectId: string, round: number, start: number, questions: AiQuestion[]) {
  let position = start;
  for (const q of questions) {
    await tx.query(
      `insert into questions (project_id, round, position, topic, trade, label, reason, input_type, unit, options)
       values ($1, $2::int, $3::int, $4, $5, $6, $7, $8, $9, $10::jsonb)`,
      [projectId, round, position++, q.topic, q.trade, q.label, q.reason, q.input_type, q.unit, JSON.stringify(q.options)],
    );
  }
}

export async function saveAnswer(db: Db, userId: string, questionId: string, answer: string | string[] | null, unknown: boolean): Promise<void> {
  if (!isUuid(questionId)) throw new NotFound();
  const clean = Array.isArray(answer) ? answer.map((a) => a.slice(0, 200)).slice(0, 30) : answer === null ? null : answer.slice(0, 3000);
  const rows = await db.query(
    `update questions q set answer = $3::jsonb, answer_unknown = $4::boolean from projects p
     where q.id = $1 and p.id = q.project_id and p.customer_id = $2 and p.status = 'questions' returning q.id`,
    [questionId, userId, clean === null || clean === "" ? null : JSON.stringify(clean), unknown],
  );
  if (!rows.length) throw new NotFound();
}

/** Returns true when a second round of questions was created instead of a brief. */
export async function finishQuestions(db: Db, ai: Ai, userId: string, projectId: string): Promise<boolean> {
  const project = await ownedProject(db, userId, projectId);
  if (project.status !== "questions") return false;
  if (project.question_round === 1) {
    const priv = await privateFor(db, projectId);
    const context = await jobContext(db, project, priv);
    const extra = await withAi(db, userId, projectId, "follow_up", "Det gick inte att granska svaren. Det du har skrivit är sparat. Försök igen.", () => ai.followUps(context));
    const questions = extra.slice(0, 5);
    if (questions.length) {
      await db.tx(async (tx) => {
        await insertAiQuestions(tx, projectId, 2, 0, questions);
        await tx.query("update projects set question_round = 2, updated_at = now() where id = $1", [projectId]);
      });
      return true;
    }
  }
  await writeBrief(db, ai, userId, project, null);
  return false;
}

async function writeBrief(db: Db, ai: Ai, userId: string, project: ProjectRow, instruction: string | null): Promise<void> {
  const [{ count }] = await db.query<{ count: number }>("select count(*)::int as count from briefs where project_id = $1", [project.id]);
  if (count >= LIMITS.briefsPerProject) throw new UserError("Underlaget har skapats om många gånger. Ändra direkt i texten i stället.");
  const priv = await privateFor(db, project.id);
  const context = await jobContext(db, project, priv);
  const previous = await latestBrief(db, project.id);
  const generated = await withAi(db, userId, project.id, "brief", "Det gick inte att skriva underlaget. Dina svar är sparade. Försök igen.", () => ai.brief(context, instruction, previous?.content ?? null));
  const content = mergeScope(scrubBrief(briefSchema.parse(generated), secretsOf(priv)));
  await db.tx(async (tx) => {
    await tx.query("update briefs set status = 'superseded' where project_id = $1 and status = 'draft'", [project.id]);
    await tx.query("insert into briefs (project_id, version, content) values ($1, $2::int, $3::jsonb)", [project.id, count + 1, JSON.stringify(content)]);
    await tx.query("update projects set status = 'brief_ready', title = $2, updated_at = now() where id = $1", [project.id, content.title.slice(0, 120)]);
  });
}

function secretsOf(priv: PrivateRow): string[] {
  return [priv.street_address, priv.contact_name, priv.phone, priv.postal_code].filter((s): s is string => Boolean(s));
}

async function latestBrief(db: Db, projectId: string): Promise<{ id: string; content: Brief; status: string } | null> {
  const [row] = await db.query<{ id: string; content: Brief; status: string }>(
    "select id, content, status from briefs where project_id = $1 and status <> 'superseded' order by version desc limit 1",
    [projectId],
  );
  return row ?? null;
}

export async function reviseBrief(db: Db, ai: Ai, userId: string, projectId: string, instruction: string): Promise<void> {
  const project = await ownedProject(db, userId, projectId);
  if (project.status !== "brief_ready") throw new UserError("Underlaget är redan godkänt.");
  const text = instruction.trim();
  if (text.length < 3) throw new UserError("Skriv vad som ska ändras.", { instruction: "Skriv vad som ska ändras." });
  await writeBrief(db, ai, userId, project, text.slice(0, 2000));
}

export async function saveBriefEdits(db: Db, userId: string, projectId: string, content: unknown): Promise<void> {
  const project = await ownedProject(db, userId, projectId);
  if (project.status !== "brief_ready") throw new UserError("Underlaget är redan godkänt.");
  const parsed = briefSchema.safeParse(content);
  if (!parsed.success) throw new UserError("Underlaget kunde inte sparas. Kontrollera att alla rader har text.");
  const priv = await privateFor(db, projectId);
  const clean = mergeScope(scrubBrief(parsed.data, secretsOf(priv)));
  await db.query("update briefs set content = $2::jsonb where project_id = $1 and status = 'draft'", [projectId, JSON.stringify(clean)]);
}

export async function switchToQuotes(db: Db, userId: string, projectId: string): Promise<void> {
  await ownedProject(db, userId, projectId);
  await db.query("update projects set readiness = 'ready_to_hire', updated_at = now() where id = $1 and readiness = 'price_only'", [projectId]);
}

export async function approveBrief(db: Db, ai: Ai, userId: string, projectId: string, slots: string[], promised: boolean): Promise<void> {
  const project = await ownedProject(db, userId, projectId);
  if (project.status !== "brief_ready") throw new UserError("Underlaget är redan godkänt.");
  if (project.readiness === "price_only") throw new UserError("Välj först att du vill ha offerter.");
  const clean = [...new Set(slots.filter((s) => /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(s)))].slice(0, 6);
  if (!clean.length) throw new UserError("Ange minst en tid då ett företag kan komma på besök.", { slots: "Ange minst en tid då ett företag kan komma på besök." });
  if (!promised) throw new UserError("Du behöver lova att svara företagen innan underlaget skickas.", { promise: "Kryssa i att du svarar varje företag." });
  await db.tx(async (tx) => {
    await tx.query("update briefs set status = 'approved', approved_at = now() where project_id = $1 and status = 'draft'", [projectId]);
    await tx.query("update projects set status = 'published', published_at = now(), visit_windows = $2::jsonb, reply_promise_at = now(), updated_at = now() where id = $1", [projectId, JSON.stringify(clean)]);
  });
  await runMatching(db, ai, projectId);
}

// ---------- Matching ----------

export async function runMatching(db: Db, ai: Ai, projectId: string): Promise<number> {
  const [project] = await db.query<ProjectRow>("select * from projects where id = $1", [projectId]);
  const [brief] = await db.query<{ content: Brief }>("select content from briefs where project_id = $1 and status = 'approved'", [projectId]);
  if (!project || !brief || !project.postal_prefix || !["published", "quoting"].includes(project.status)) return 0;
  const job: JobForMatching = {
    postalPrefix: project.postal_prefix,
    tradesNeeded: brief.content.trades_needed,
    jobTypes: project.job_types,
    highEstimateSek: brief.content.price_estimate.high_sek,
  };
  const existing = await db.query<{ company_id: string; trades: Trade[] }>("select company_id, trades from matches where project_id = $1 and status <> 'declined'", [projectId]);
  const excluded = new Set((await db.query<{ company_id: string }>("select company_id from matches where project_id = $1", [projectId])).map((r) => r.company_id));
  const companies = await db.query<CandidateCompany>(
    `select c.*, (select count(*)::int from matches m where m.company_id = c.id and m.status in ('invited','viewed','visit_requested','visit_confirmed')) as open_jobs
     from companies c where c.status = 'approved' and c.accepting_jobs`,
  );
  const scored: ScoredCompany[] = companies
    .filter((c) => !excluded.has(c.id) && isEligible(c, job))
    .map((c) => scoreCompany(c, job))
    .sort((a, b) => b.score - a.score);
  const ordered = await rankWithAi(ai, brief.content, scored, job, existing.map((e) => e.trades));
  const picked = pickCompanies(ordered, job, existing.map((e) => e.trades));
  for (const p of picked) {
    await db.query(
      "insert into matches (project_id, company_id, score, reasons, trades) values ($1, $2, $3::int, $4::jsonb, $5::jsonb) on conflict do nothing",
      [projectId, p.company.id, p.score, JSON.stringify(p.reasons), JSON.stringify(p.trades)],
    );
  }
  if (picked.length || existing.length) await db.query("update projects set status = 'quoting', updated_at = now() where id = $1 and status = 'published'", [projectId]);
  return picked.length;
}

async function rankWithAi(ai: Ai, brief: Brief, scored: ScoredCompany[], job: JobForMatching, invited: Trade[][]): Promise<ScoredCompany[]> {
  // Ranking only matters when there are more qualified companies than places.
  const crowded = job.tradesNeeded.some((trade) => scored.filter((s) => s.trades.includes(trade)).length + invited.filter((t) => t.includes(trade)).length > MAX_COMPANIES_PER_TRADE);
  if (!crowded) return scored;
  try {
    const ranked = await ai.rank({
      brief,
      candidates: scored.map((s) => ({ id: s.company.id, name: s.company.name, description: s.company.description, trades: s.trades, reasons: s.reasons })),
    });
    const byId = new Map(scored.map((s) => [s.company.id, s]));
    const out: ScoredCompany[] = [];
    for (const r of ranked) {
      const hit = byId.get(r.company_id);
      if (!hit) continue;
      byId.delete(r.company_id);
      out.push({ ...hit, reasons: [r.reason, ...hit.reasons] });
    }
    return [...out, ...byId.values()];
  } catch (error) {
    console.error("AI ranking failed, using rule order", error);
    return scored;
  }
}

export async function rematchOpenProjects(db: Db, ai: Ai): Promise<void> {
  const open = await db.query<{ id: string }>("select id from projects where status in ('published','quoting')");
  for (const { id } of open) await runMatching(db, ai, id);
}

// ---------- Files ----------

export interface FileMeta {
  id: string;
  kind: "photo" | "drawing";
  name: string;
  question_id: string | null;
}

export async function addFile(db: Db, userId: string, projectId: string, input: { kind: "photo" | "drawing"; name: string; data: Uint8Array; questionId: string | null }): Promise<FileMeta> {
  const project = await ownedProject(db, userId, projectId);
  if (!["draft", "questions", "brief_ready"].includes(project.status)) throw new UserError("Bilder kan inte ändras efter att underlaget har skickats.");
  if (input.data.length > LIMITS.maxFileBytes) throw new UserError("Filen är för stor. Den får vara högst 4 MB.");
  const isJpeg = input.data[0] === 0xff && input.data[1] === 0xd8 && input.data[2] === 0xff;
  const isPdf = input.data[0] === 0x25 && input.data[1] === 0x50 && input.data[2] === 0x44 && input.data[3] === 0x46;
  if (input.kind === "photo" && !isJpeg) throw new UserError("Den här bilden går inte att läsa. Spara den som JPG och försök igen.");
  if (input.kind === "drawing" && !isPdf) throw new UserError("Ritningar ska vara PDF-filer.");
  const [{ count }] = await db.query<{ count: number }>("select count(*)::int as count from files where project_id = $1 and kind = $2", [projectId, input.kind]);
  if (count >= (input.kind === "photo" ? LIMITS.files : LIMITS.drawings)) throw new UserError(input.kind === "photo" ? "Du kan lägga till högst 20 bilder." : "Du kan lägga till högst 5 ritningar.");
  let questionId: string | null = null;
  if (input.questionId && isUuid(input.questionId)) {
    const [q] = await db.query<{ id: string }>("select id from questions where id = $1 and project_id = $2", [input.questionId, projectId]);
    questionId = q?.id ?? null;
  }
  const [row] = await db.query<FileMeta>(
    "insert into files (project_id, question_id, kind, mime, name, size, data) values ($1, $2, $3, $4, $5, $6::int, $7) returning id, kind, name, question_id",
    [projectId, questionId, input.kind, input.kind === "photo" ? "image/jpeg" : "application/pdf", input.name.slice(0, 120), input.data.length, input.data],
  );
  return row;
}

export async function deleteFile(db: Db, userId: string, fileId: string): Promise<void> {
  if (!isUuid(fileId)) throw new NotFound();
  const rows = await db.query(
    "delete from files f using projects p where f.id = $1 and p.id = f.project_id and p.customer_id = $2 and p.status in ('draft','questions','brief_ready') returning f.id",
    [fileId, userId],
  );
  if (!rows.length) throw new NotFound();
}

/** The one place that decides who may fetch a file. */
export async function readFile(db: Db, userId: string, isAdmin: boolean, fileId: string): Promise<{ mime: string; name: string; data: Uint8Array }> {
  if (!isUuid(fileId)) throw new NotFound();
  const [row] = await db.query<{ mime: string; name: string; data: Uint8Array }>(
    `select f.mime, f.name, f.data from files f join projects p on p.id = f.project_id
     where f.id = $1 and ($3::boolean or p.customer_id = $2 or exists (
       select 1 from matches m join companies c on c.id = m.company_id
       where m.project_id = p.id and c.owner_id = $2 and c.status = 'approved' and m.status <> 'declined'))`,
    [fileId, userId, isAdmin],
  );
  if (!row) throw new NotFound();
  return row;
}

// ---------- Customer: views and decisions ----------

export interface MatchView {
  id: string;
  status: string;
  reasons: string[];
  trades: Trade[];
  contact_shared: boolean;
  decline_reason: string | null;
  company_name: string;
  company_description: string;
  org_number: string;
  wetroom_cert: string | null;
  el_registration: string | null;
  visit: { slot: string; note: string; status: string } | null;
  quote: QuoteView | null;
}

export interface QuoteItem {
  ref: string;
  trade: string;
  task: string;
  amount_sek: number;
  labour_sek: number;
}

export interface QuoteView {
  id: string;
  total_sek: number;
  labour_sek: number;
  rot_sek: number;
  price_model: "fixed" | "running";
  start_text: string;
  duration_text: string;
  valid_until: string;
  terms: string;
  items: QuoteItem[];
  status: string;
}

export interface QuestionRow {
  id: string;
  round: number;
  topic: string;
  trade: string | null;
  label: string;
  reason: string;
  measure_help: string | null;
  input_type: "number" | "text" | "longtext" | "single" | "multi" | "photo";
  unit: string | null;
  options: string[];
  answer: string | string[] | null;
  answer_unknown: boolean;
}

export async function customerProject(db: Db, userId: string, projectId: string) {
  const project = await ownedProject(db, userId, projectId);
  const priv = await privateFor(db, projectId);
  const questions = await db.query<QuestionRow>("select * from questions where project_id = $1 and round = $2::int order by position", [projectId, project.question_round || 1]);
  const files = await db.query<FileMeta>("select id, kind, name, question_id from files where project_id = $1 order by created_at", [projectId]);
  const brief = await latestBrief(db, projectId);
  const matches = await db.query<MatchView>(
    `select m.id, m.status, m.reasons, m.trades, m.contact_shared, m.decline_reason, c.name as company_name, c.description as company_description, c.org_number, c.wetroom_cert, c.el_registration,
       (select to_jsonb(v) - 'id' - 'match_id' - 'created_at' from site_visits v where v.match_id = m.id) as visit,
       (select to_jsonb(q) - 'match_id' - 'created_at' from quotes q where q.match_id = m.id) as quote
     from matches m join companies c on c.id = m.company_id where m.project_id = $1 order by m.score desc`,
    [projectId],
  );
  return { project, private: priv, questions, files, brief, matches };
}

export async function listCustomerProjects(db: Db, userId: string) {
  return db.query<{ id: string; title: string; status: string; created_at: Date; city: string | null; quotes: number }>(
    `select p.id, p.title, p.status, p.created_at, p.city,
       (select count(*)::int from quotes q join matches m on m.id = q.match_id where m.project_id = p.id) as quotes
     from projects p where p.customer_id = $1 and p.status <> 'cancelled' order by p.created_at desc`,
    [userId],
  );
}

export async function confirmVisit(db: Db, userId: string, matchId: string): Promise<void> {
  const match = await ownedMatch(db, userId, matchId);
  if (match.status !== "visit_requested") throw new UserError("Besöket går inte att bekräfta längre.");
  await db.tx(async (tx) => {
    await tx.query("update site_visits set status = 'confirmed' where match_id = $1", [matchId]);
    await tx.query("update matches set status = 'visit_confirmed', contact_shared = true where id = $1", [matchId]);
  });
}

export async function declineVisit(db: Db, userId: string, matchId: string): Promise<void> {
  const match = await ownedMatch(db, userId, matchId);
  if (match.status !== "visit_requested") throw new UserError("Besöket går inte att avböja längre.");
  await db.tx(async (tx) => {
    await tx.query("update site_visits set status = 'declined' where match_id = $1", [matchId]);
    await tx.query("update matches set status = 'viewed' where id = $1", [matchId]);
  });
}

export async function acceptQuote(db: Db, userId: string, matchId: string): Promise<void> {
  const match = await ownedMatch(db, userId, matchId);
  if (match.status !== "quoted") throw new UserError("Offerten går inte att acceptera längre.");
  await db.tx(async (tx) => {
    await tx.query("update quotes set status = 'accepted' where match_id = $1", [matchId]);
    await tx.query("update matches set status = 'won', contact_shared = true where id = $1", [matchId]);
    const [brief] = await tx.query<{ content: Brief }>("select content from briefs where project_id = $1 and status = 'approved'", [match.project_id]);
    const won = await tx.query<{ trades: Trade[] }>("select trades from matches where project_id = $1 and status = 'won'", [match.project_id]);
    const covered = new Set(won.flatMap((w) => w.trades));
    const others = await tx.query<{ id: string; trades: Trade[] }>("select id, trades from matches where project_id = $1 and status not in ('won','declined','lost')", [match.project_id]);
    for (const other of others) {
      if (!other.trades.every((t) => covered.has(t))) continue;
      await tx.query("update matches set status = 'lost', outcome_reason = 'Kunden valde ett annat företag.' where id = $1", [other.id]);
      await tx.query("update quotes set status = 'declined' where match_id = $1", [other.id]);
    }
    if (brief.content.trades_needed.every((t) => covered.has(t))) {
      await tx.query("update projects set status = 'awarded', updated_at = now() where id = $1", [match.project_id]);
    }
  });
}

export async function declineQuote(db: Db, userId: string, matchId: string, reason: string): Promise<void> {
  const match = await ownedMatch(db, userId, matchId);
  if (match.status !== "quoted") throw new UserError("Offerten går inte att avböja längre.");
  const text = reason.trim();
  if (!text) throw new UserError("Välj en anledning. Företaget får se den.", { reason: "Välj en anledning." });
  await db.tx(async (tx) => {
    await tx.query("update quotes set status = 'declined' where match_id = $1", [matchId]);
    await tx.query("update matches set status = 'lost', outcome_reason = $2 where id = $1", [matchId, text.slice(0, 300)]);
  });
}

// ---------- Companies ----------

export const companySchema = z.object({
  name: z.string().trim().min(2, "Skriv företagets namn.").max(120),
  org_number: z.string().trim().refine(isValidOrgNumber, "Organisationsnumret stämmer inte. Kontrollera siffrorna."),
  description: z.string().trim().min(20, "Beskriv företaget med minst en mening.").max(1000),
  trades: z.array(z.enum(TRADES)).min(1, "Välj minst ett yrke."),
  postal_prefixes: z.array(z.string().regex(/^\d{2}$/)).min(1, "Ange minst ett område med två siffror, till exempel 11, 12, 13."),
  el_registration: z.string().trim().max(60).nullable(),
  wetroom_cert: z.string().trim().max(120).nullable(),
  has_f_skatt: z.literal(true, { error: "F-skatt krävs för att ansluta företaget." }),
  has_insurance: z.literal(true, { error: "Ansvarsförsäkring krävs för att ansluta företaget." }),
  min_job_sek: z.number().int().min(0).max(100_000_000),
}).refine((v) => !v.trades.includes("el") || Boolean(v.el_registration), {
  path: ["el_registration"],
  message: "Elinstallationsföretag måste ange sitt registreringsnummer.",
});
export type CompanyInput = z.infer<typeof companySchema>;

export async function createCompany(db: Db, userId: string, input: CompanyInput): Promise<void> {
  const org = input.org_number.replace(/\D/g, "");
  const [taken] = await db.query("select 1 from companies where org_number = $1", [org]);
  if (taken) throw new UserError("Det finns redan ett konto för det här organisationsnumret.", { org_number: "Det finns redan ett konto för det här organisationsnumret." });
  if (await companyOf(db, userId)) throw new UserError("Ditt konto är redan kopplat till ett företag.");
  await db.query(
    `insert into companies (owner_id, name, org_number, description, trades, postal_prefixes, el_registration, wetroom_cert, has_f_skatt, has_insurance, min_job_sek)
     values ($1, $2, $3, $4, $5::jsonb, $6::jsonb, $7, $8, $9::boolean, $10::boolean, $11::int)`,
    [userId, input.name, org, input.description, JSON.stringify(input.trades), JSON.stringify(input.postal_prefixes), input.el_registration, input.wetroom_cert, input.has_f_skatt, input.has_insurance, input.min_job_sek],
  );
}

export async function companyInbox(db: Db, companyId: string) {
  return db.query<{ id: string; status: string; title: string; city: string | null; created_at: Date; content: Brief }>(
    `select m.id, m.status, p.title, p.city, m.created_at, b.content
     from matches m join projects p on p.id = m.project_id join briefs b on b.project_id = p.id and b.status = 'approved'
     where m.company_id = $1 order by m.created_at desc`,
    [companyId],
  );
}

/** Everything a company may see about a job. Reads only the safe project columns. */
export async function companyJob(db: Db, userId: string, matchId: string) {
  const { company, match } = await companyMatch(db, userId, matchId);
  if (match.status === "invited") await db.query("update matches set status = 'viewed' where id = $1", [matchId]);
  const [project] = await db.query<Omit<ProjectRow, "customer_id" | "postal_prefix" | "budget_band" | "question_round" | "published_at">>(
    `select ${COMPANY_COLUMNS_FROM_PROJECT} from projects p where p.id = $1`,
    [match.project_id],
  );
  const [brief] = await db.query<{ content: Brief }>("select content from briefs where project_id = $1 and status = 'approved'", [match.project_id]);
  const files = await db.query<FileMeta & { task: string | null }>(
    "select f.id, f.kind, f.name, f.question_id, q.label as task from files f left join questions q on q.id = f.question_id where f.project_id = $1 order by f.created_at",
    [match.project_id],
  );
  const [stats] = await db.query<{ total: number; answered: number; unknown: number }>(
    `select count(*)::int as total,
       count(*) filter (where q.answer is not null or exists (select 1 from files f where f.question_id = q.id))::int as answered,
       count(*) filter (where q.answer_unknown)::int as unknown
     from questions q where q.project_id = $1`,
    [match.project_id],
  );
  const [{ competitors }] = await db.query<{ competitors: number }>(
    "select count(*)::int as competitors from matches where project_id = $1 and id <> $2 and status <> 'declined'",
    [match.project_id, matchId],
  );
  const [visit] = await db.query<{ slot: string; note: string; status: string }>("select slot, note, status from site_visits where match_id = $1", [matchId]);
  const [quote] = await db.query<QuoteView>("select * from quotes where match_id = $1", [matchId]);
  // Contact details are fetched only after the customer has chosen this company.
  const contact = match.contact_shared ? await privateFor(db, match.project_id) : null;
  return {
    company,
    match,
    project,
    brief: brief.content,
    lines: quoteLines(brief.content, match.trades),
    files,
    stats,
    competitors,
    visit: visit ?? null,
    quote: quote ?? null,
    contact: contact ? { street_address: contact.street_address, postal_code: contact.postal_code, phone: contact.phone, contact_name: contact.contact_name } : null,
  };
}

function assertOpen(status: string) {
  if (["declined", "lost", "won"].includes(status)) throw new UserError("Jobbet är avslutat.");
}

export async function declineJob(db: Db, userId: string, matchId: string, reason: string): Promise<void> {
  const { match } = await companyMatch(db, userId, matchId);
  assertOpen(match.status);
  if (match.status === "quoted") throw new UserError("Du har redan lämnat offert.");
  if (!reason.trim()) throw new UserError("Välj en anledning.", { reason: "Välj en anledning." });
  await db.query("update matches set status = 'declined', decline_reason = $2, contact_shared = false where id = $1", [matchId, reason.trim().slice(0, 300)]);
}

export async function requestVisit(db: Db, userId: string, matchId: string, slot: string, note: string): Promise<void> {
  const { match } = await companyMatch(db, userId, matchId);
  assertOpen(match.status);
  if (!["invited", "viewed"].includes(match.status)) throw new UserError("Besök är redan bokat.");
  const [project] = await db.query<{ visit_windows: string[] }>("select visit_windows from projects where id = $1", [match.project_id]);
  if (!project.visit_windows.includes(slot)) throw new UserError("Välj en av tiderna som kunden har angett.", { slot: "Välj en av tiderna." });
  await db.tx(async (tx) => {
    await tx.query(
      "insert into site_visits (match_id, slot, note, status) values ($1, $2, $3, 'requested') on conflict (match_id) do update set slot = excluded.slot, note = excluded.note, status = 'requested'",
      [matchId, slot, note.trim().slice(0, 500)],
    );
    await tx.query("update matches set status = 'visit_requested' where id = $1", [matchId]);
  });
}

export const quoteSchema = z.object({
  price_model: z.enum(["fixed", "running"]),
  start_text: z.string().trim().min(2, "Skriv när ni kan börja.").max(100),
  duration_text: z.string().trim().min(2, "Skriv hur lång tid jobbet tar.").max(100),
  valid_until: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Välj hur länge offerten gäller."),
  terms: z.string().trim().max(3000),
  amounts: z.record(z.string(), z.object({ amount_sek: z.number().int().min(0), labour_sek: z.number().int().min(0) })),
});
export type QuoteInput = z.infer<typeof quoteSchema>;

export async function submitQuote(db: Db, userId: string, matchId: string, input: QuoteInput): Promise<void> {
  const { match } = await companyMatch(db, userId, matchId);
  assertOpen(match.status);
  if (match.status === "quoted") throw new UserError("Du har redan lämnat offert.");
  const [brief] = await db.query<{ content: Brief }>("select content from briefs where project_id = $1 and status = 'approved'", [match.project_id]);
  const [project] = await db.query<{ wants_rot: boolean }>("select wants_rot from projects where id = $1", [match.project_id]);
  const lines = quoteLines(brief.content, match.trades);
  const fields: Record<string, string> = {};
  const items: QuoteItem[] = [];
  for (const line of lines) {
    const entry = input.amounts[line.ref];
    if (!entry || entry.amount_sek <= 0) {
      fields[`amount:${line.ref}`] = "Ange ett belopp.";
      continue;
    }
    if (entry.labour_sek > entry.amount_sek) {
      fields[`labour:${line.ref}`] = "Arbetskostnaden kan inte vara högre än beloppet.";
      continue;
    }
    items.push({ ...line, ...entry });
  }
  if (Object.keys(fields).length) throw new UserError("Några rader saknar belopp.", fields);
  const total = items.reduce((sum, i) => sum + i.amount_sek, 0);
  const labour = items.reduce((sum, i) => sum + i.labour_sek, 0);
  const rot = project.wants_rot ? rotDeduction(labour) : 0;
  await db.tx(async (tx) => {
    await tx.query(
      `insert into quotes (match_id, total_sek, labour_sek, rot_sek, price_model, start_text, duration_text, valid_until, terms, items)
       values ($1, $2::int, $3::int, $4::int, $5, $6, $7, $8, $9, $10::jsonb)`,
      [matchId, total, labour, rot, input.price_model, input.start_text, input.duration_text, input.valid_until, input.terms, JSON.stringify(items)],
    );
    await tx.query("update matches set status = 'quoted' where id = $1", [matchId]);
  });
}

// ---------- Admin ----------

export async function listCompanies(db: Db) {
  return db.query<CompanyRow & { email: string; created_at: Date }>(
    "select c.*, u.email from companies c join users u on u.id = c.owner_id order by (c.status = 'pending') desc, c.created_at desc",
  );
}

export async function setCompanyStatus(db: Db, ai: Ai, companyId: string, status: "approved" | "suspended"): Promise<void> {
  if (!isUuid(companyId)) throw new NotFound();
  await db.query("update companies set status = $2 where id = $1", [companyId, status]);
  if (status === "approved") await rematchOpenProjects(db, ai);
}

export { eligibleTrades };
