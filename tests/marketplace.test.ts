import { beforeEach, describe, expect, it } from "vitest";
import { createMemoryDb, type Db } from "@/lib/db";
import { fakeAi } from "@/lib/ai";
import { mergeScope, quoteLines, scrubText } from "@/lib/brief";
import { fakeAi as makeFake } from "@/lib/ai";
import { isValidOrgNumber, MAX_COMPANIES_PER_TRADE } from "@/lib/matching";
import { REQUIREMENTS } from "@/lib/job-requirements";
import {
  acceptQuote, addFile, cleanPrefill, approveBrief, companyInvite, companyJob, confirmVisit, createCompany, createCompanyByAdmin, createProject, customerProject, declineQuote,
  finishQuestions, generateQuestions, NotFound, readFile, rematchOpenProjects, requestVisit, saveBasics, setCompanyStatus, submitQuote, UserError, type AdminCompanyInput, type BasicsInput,
} from "@/lib/marketplace";
import { hashToken, verifyPassword } from "@/lib/passwords";

const ai = fakeAi();
const JPEG = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3]);
let db: Db;
let n = 0;

const basics = (over: Partial<BasicsInput> = {}): BasicsInput => ({
  postal_code: "123 45", city: "Nacka", street_address: "Hemliga vägen 7", contact_name: "Anders Testsson", phone: "070-123 45 67",
  housing_type: "villa", year_built: 1974, desired_start: "Inom 3 månader", budget_band: null, wants_rot: true, readiness: "ready_to_hire",
  is_decision_maker: true, approval_status: "not_needed", financing_status: "ready", price_model: "fixed",
  access: { floor: "0", elevator: "Nej", parking: "På tomten", container: "Ja", occupied: "Ja", water_wc: "Ja", pets: "Nej", blocked_hours: "" }, ...over,
});

async function user(): Promise<string> {
  n += 1;
  const [{ id }] = await db.query<{ id: string }>("insert into users (email, password_hash, full_name) values ($1, 'x', 'T') returning id", [`u${n}@test.se`]);
  return id;
}

const ORGS = ["5560360793", "5565475489", "5567037485", "5569181865", "5564582640"];
async function company(trades: ("bygg" | "el" | "vvs")[], prefix = "12", approve = true) {
  const owner = await user();
  await createCompany(db, owner, {
    name: `Firma ${n}`, org_number: ORGS[n % ORGS.length].slice(0, 9) + String(n % 10), description: "Vi gör det mesta inom renovering i Stockholm.", trades, postal_prefixes: [prefix],
    el_registration: trades.includes("el") ? "EL-123" : null, wetroom_cert: null, has_f_skatt: true, has_insurance: true, min_job_sek: 0,
  });
  const [row] = await db.query<{ id: string }>("select id from companies where owner_id = $1", [owner]);
  if (approve) await setCompanyStatus(db, ai, row.id, "approved");
  return { owner, id: row.id };
}

async function publishedProject(over: Partial<BasicsInput> = {}) {
  const customer = await user();
  const id = await createProject(db, customer, "Vi vill renovera badrummet på 6 kvm.");
  await saveBasics(db, customer, id, basics(over));
  await generateQuestions(db, ai, customer, id);
  await finishQuestions(db, ai, customer, id);
  await approveBrief(db, ai, customer, id, ["2026-12-01T16:00"], true);
  return { customer, id };
}

const matchOf = async (projectId: string, companyId: string) =>
  (await db.query<{ id: string }>("select id from matches where project_id = $1 and company_id = $2", [projectId, companyId]))[0]?.id;

beforeEach(async () => {
  db = await createMemoryDb();
});

describe("frågor", () => {
  it("always includes every required question for the job type", async () => {
    const customer = await user();
    const id = await createProject(db, customer, "Renovera badrum");
    await saveBasics(db, customer, id, basics());
    await generateQuestions(db, ai, customer, id);
    const keys = (await db.query<{ requirement_key: string }>("select requirement_key from questions where project_id = $1", [id])).map((r) => r.requirement_key);
    for (const key of ["badrum.langd", "badrum.bjalklag", "badrum.flytt", "badrum.ventilation", "badrum.bild_brunn"]) expect(keys).toContain(key);
  });
});

describe("underlag", () => {
  it("merges repeated trades so quote lines stay unique", async () => {
    const brief = await makeFake().brief({ description: "x", facts: {}, files: [], answers: [] }, null, null);
    const split = { ...brief, scope: [...brief.scope, { trade: "bygg" as const, items: [{ task: "Kakel", detail: "", quantity: null, unit: null, basis: "customer" as const }] }] };
    const merged = mergeScope(split);
    expect(merged.scope.filter((g) => g.trade === "bygg")).toHaveLength(1);
    const refs = quoteLines(merged, ["bygg", "vvs", "el"]).map((l) => l.ref);
    expect(new Set(refs).size).toBe(refs.length);
  });
});

describe("förifyllda svar", () => {
  it("keeps only answers that fit the question", () => {
    const move = REQUIREMENTS.badrum.find((r) => r.key === "badrum.flytt")!;
    const length = REQUIREMENTS.badrum.find((r) => r.key === "badrum.langd")!;
    expect(cleanPrefill(move, "Dusch istället för badkar")).toBeNull();
    expect(cleanPrefill(move, "ja")).toBe("Ja");
    expect(cleanPrefill(length, "2.4")).toBe("2,4");
    expect(cleanPrefill(length, "cirka 2 meter")).toBeNull();
  });
});

describe("integritet", () => {
  it("keeps other customers out of a project", async () => {
    const { id } = await publishedProject();
    const stranger = await user();
    await expect(customerProject(db, stranger, id)).rejects.toBeInstanceOf(NotFound);
  });

  it("hides address and description from a matched company until the customer chooses it", async () => {
    const firm = await company(["bygg", "vvs", "el"]);
    const { customer, id } = await publishedProject();
    const matchId = await matchOf(id, firm.id);
    const before = await companyJob(db, firm.owner, matchId);
    expect(before.contact).toBeNull();
    const text = JSON.stringify(before);
    expect(text).not.toContain("Hemliga vägen");
    expect(text).not.toContain("070-123");
    expect(text).not.toContain("Vi vill renovera badrummet");
    await requestVisit(db, firm.owner, matchId, "2026-12-01T16:00", "");
    await confirmVisit(db, customer, matchId);
    const after = await companyJob(db, firm.owner, matchId);
    expect(after.contact?.street_address).toBe("Hemliga vägen 7");
  });

  it("does not let an unmatched company open a job or a photo", async () => {
    const firm = await company(["bygg", "vvs", "el"]);
    const outsider = await company(["bygg"], "90");
    const customer = await user();
    const id = await createProject(db, customer, "Renovera badrum");
    const file = await addFile(db, customer, id, { kind: "photo", name: "a.jpg", data: JPEG, questionId: null });
    await saveBasics(db, customer, id, basics());
    await generateQuestions(db, ai, customer, id);
    await finishQuestions(db, ai, customer, id);
    await approveBrief(db, ai, customer, id, ["2026-12-01T16:00"], true);
    const matchId = await matchOf(id, firm.id);
    await expect(companyJob(db, outsider.owner, matchId)).rejects.toBeInstanceOf(NotFound);
    await expect(readFile(db, outsider.owner, false, file.id)).rejects.toBeInstanceOf(NotFound);
    await expect(readFile(db, firm.owner, false, file.id)).resolves.toBeTruthy();
  });

  it("rejects a file that is not really a JPEG", async () => {
    const customer = await user();
    const id = await createProject(db, customer, "Renovera badrum");
    await expect(addFile(db, customer, id, { kind: "photo", name: "a.jpg", data: new Uint8Array([60, 115, 118, 103]), questionId: null })).rejects.toBeInstanceOf(UserError);
  });

  it("removes phone numbers and emails from text", () => {
    const out = scrubText("Ring Anders på 070-123 45 67 eller a@b.se", ["Anders"]);
    expect(out).not.toMatch(/070|a@b|Anders/);
  });
});

describe("matchning", () => {
  it("invites at most three companies per trade", async () => {
    for (let i = 0; i < 5; i += 1) await company(["bygg", "vvs", "el"]);
    const { id } = await publishedProject();
    const rows = await db.query("select id from matches where project_id = $1", [id]);
    expect(rows.length).toBe(MAX_COMPANIES_PER_TRADE);
  });

  it("skips companies outside the area and those not approved", async () => {
    const away = await company(["bygg", "vvs", "el"], "90");
    const pending = await company(["bygg", "vvs", "el"], "12", false);
    const { id } = await publishedProject();
    expect(await matchOf(id, away.id)).toBeUndefined();
    expect(await matchOf(id, pending.id)).toBeUndefined();
  });

  it("never sends a price-only job to companies", async () => {
    await company(["bygg", "vvs", "el"]);
    const customer = await user();
    const id = await createProject(db, customer, "Renovera badrum");
    await saveBasics(db, customer, id, basics({ readiness: "price_only" }));
    await generateQuestions(db, ai, customer, id);
    await finishQuestions(db, ai, customer, id);
    await expect(approveBrief(db, ai, customer, id, ["2026-12-01T16:00"], true)).rejects.toBeInstanceOf(UserError);
  });

  it("matches waiting jobs when a company is approved later", async () => {
    const { id } = await publishedProject();
    const firm = await company(["bygg", "vvs", "el"]);
    expect(await matchOf(id, firm.id)).toBeTruthy();
  });

  it("validates Swedish organisation numbers", () => {
    expect(isValidOrgNumber("556036-0793")).toBe(true);
    expect(isValidOrgNumber("556036-0794")).toBe(false);
  });
});

describe("offerter", () => {
  const quoteInput = (lines: { ref: string }[]) => ({
    price_model: "fixed" as const, start_text: "Januari", duration_text: "3 veckor", valid_until: "2026-12-31", terms: "",
    amounts: Object.fromEntries(lines.map((l) => [l.ref, { amount_sek: 40000, labour_sek: 25000 }])),
  });

  it("awards a job and tells the other companies why", async () => {
    const a = await company(["bygg", "vvs", "el"]);
    const b = await company(["bygg", "vvs", "el"]);
    const { customer, id } = await publishedProject();
    const ma = await matchOf(id, a.id);
    const mb = await matchOf(id, b.id);
    const job = await companyJob(db, a.owner, ma);
    await submitQuote(db, a.owner, ma, quoteInput(job.lines));
    await submitQuote(db, b.owner, mb, quoteInput(job.lines));
    await acceptQuote(db, customer, ma);
    const lost = await companyJob(db, b.owner, mb);
    expect(lost.match.status).toBe("lost");
    expect(lost.match.outcome_reason).toBeTruthy();
    const won = await companyJob(db, a.owner, ma);
    expect(won.contact?.phone).toBe("070-123 45 67");
    const view = await customerProject(db, customer, id);
    expect(view.project.status).toBe("awarded");
  });

  it("caps the ROT deduction and applies it to labour only", async () => {
    const a = await company(["bygg", "vvs", "el"]);
    const { id } = await publishedProject();
    const ma = await matchOf(id, a.id);
    const job = await companyJob(db, a.owner, ma);
    await submitQuote(db, a.owner, ma, { ...quoteInput(job.lines), amounts: Object.fromEntries(job.lines.map((l) => [l.ref, { amount_sek: 300000, labour_sek: 200000 }])) });
    const after = await companyJob(db, a.owner, ma);
    expect(after.quote?.rot_sek).toBe(50000);
  });

  it("requires a reason when a quote is declined", async () => {
    const a = await company(["bygg", "vvs", "el"]);
    const { customer, id } = await publishedProject();
    const ma = await matchOf(id, a.id);
    const job = await companyJob(db, a.owner, ma);
    await submitQuote(db, a.owner, ma, quoteInput(job.lines));
    await expect(declineQuote(db, customer, ma, "  ")).rejects.toBeInstanceOf(UserError);
  });

  it("does not let a company book a time the customer did not offer", async () => {
    const a = await company(["bygg", "vvs", "el"]);
    const { id } = await publishedProject();
    const ma = await matchOf(id, a.id);
    await expect(requestVisit(db, a.owner, ma, "2030-01-01T08:00", "")).rejects.toBeInstanceOf(UserError);
  });
});

describe("företag som admin lägger till", () => {
  const input = (over: Partial<AdminCompanyInput> = {}): AdminCompanyInput => ({
    name: "Testbygg AB", org_number: "556677-8899", contact_name: "Sara Bygg", email: "Sara@Testbygg.se", trades: ["bygg", "vvs"], postal_prefixes: ["12"], el_registration: null, checked: true, ...over,
  });

  it("approves the company at once and gives a login code instead of a password", async () => {
    const token = await createCompanyByAdmin(db, input());
    const [row] = await db.query<{ status: string; email: string; password_hash: string; user_id: string }>(
      "select c.status, u.email, u.password_hash, u.id as user_id from companies c join users u on u.id = c.owner_id where c.org_number = '5566778899'",
    );
    expect(row.status).toBe("approved");
    expect(row.email).toBe("sara@testbygg.se");
    expect(await verifyPassword("", row.password_hash)).toBe(false);
    const [invite] = await db.query<{ user_id: string; days: number }>(
      "select user_id, extract(day from expires_at - now())::int as days from password_resets where token_hash = $1 and used_at is null", [hashToken(token)],
    );
    expect(invite.user_id).toBe(row.user_id);
    expect(invite.days).toBeGreaterThanOrEqual(13);
  });

  it("sends waiting jobs to the new company", async () => {
    const { id } = await publishedProject();
    await createCompanyByAdmin(db, input());
    await rematchOpenProjects(db, ai);
    const [firm] = await db.query<{ id: string }>("select id from companies where org_number = '5566778899'");
    expect(await matchOf(id, firm.id)).toBeTruthy();
  });

  it("refuses a second company with the same organisation number or contact", async () => {
    await createCompanyByAdmin(db, input());
    await expect(createCompanyByAdmin(db, input({ email: "annan@test.se" }))).rejects.toBeInstanceOf(UserError);
    await expect(createCompanyByAdmin(db, input({ org_number: "5560360793" }))).rejects.toBeInstanceOf(UserError);
    const [{ count }] = await db.query<{ count: number }>("select count(*)::int as count from companies");
    expect(count).toBe(1);
  });

  it("creates a fresh login link on request", async () => {
    const first = await createCompanyByAdmin(db, input());
    const [firm] = await db.query<{ id: string }>("select id from companies where org_number = '5566778899'");
    const second = await companyInvite(db, firm.id);
    expect(second).not.toBe(first);
    await expect(companyInvite(db, "00000000-0000-0000-0000-000000000000")).rejects.toBeInstanceOf(NotFound);
  });
});
