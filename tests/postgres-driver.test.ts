import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { PGLiteSocketServer } from "@electric-sql/pglite-socket";
import { fakeAi } from "@/lib/ai";
import { getDb, schemaSql, type Db } from "@/lib/db";
import { addFile, approveBrief, companyJob, createCompany, createProject, customerProject, finishQuestions, generateQuestions, readFile, saveBasics, setCompanyStatus } from "@/lib/marketplace";

// Production talks to Postgres through the postgres driver, which binds parameters differently from the local database.
const PORT = 54839;
let server: PGLiteSocketServer;
let db: Db;
const ai = fakeAi();

beforeAll(async () => {
  const pg = new PGlite();
  await pg.exec(schemaSql);
  server = new PGLiteSocketServer({ db: pg, port: PORT, host: "127.0.0.1" });
  await server.start();
  vi.stubEnv("DATABASE_URL", `postgres://postgres:postgres@127.0.0.1:${PORT}/postgres?sslmode=disable`);
  db = await getDb();
});

afterAll(async () => {
  await server.stop();
  vi.unstubAllEnvs();
});

async function user(email: string) {
  const [{ id }] = await db.query<{ id: string }>("insert into users (email, password_hash, full_name) values ($1, 'x', 'T') returning id", [email]);
  return id;
}

describe("postgres driver", () => {
  it("runs a whole job, including JSON, arrays and binary files", async () => {
    const owner = await user("firma@x.se");
    await createCompany(db, owner, { name: "Firma", org_number: "5560360793", description: "Vi renoverar badrum i Stockholm.", trades: ["bygg", "vvs", "el"], postal_prefixes: ["12"], el_registration: "EL-1", wetroom_cert: null, has_f_skatt: true, has_insurance: true, min_job_sek: 0 });
    const [company] = await db.query<{ id: string }>("select id from companies where owner_id = $1", [owner]);
    await setCompanyStatus(db, ai, company.id, "approved");

    const customer = await user("kund@x.se");
    const id = await createProject(db, customer, "Renovera badrum");
    const bytes = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 9, 8, 7]);
    const file = await addFile(db, customer, id, { kind: "photo", name: "a.jpg", data: bytes, questionId: null });
    await saveBasics(db, customer, id, {
      postal_code: "12345", city: "Nacka", street_address: "Gatan 1", contact_name: "Kund", phone: "0701234567", housing_type: "villa", year_built: null, desired_start: "Snart", budget_band: null,
      wants_rot: true, readiness: "ready_to_hire", is_decision_maker: true, approval_status: "not_needed", financing_status: "ready", price_model: "fixed",
      access: { floor: "0", elevator: "Nej", parking: "x", container: "Ja", occupied: "Ja", water_wc: "Ja", pets: "Nej", blocked_hours: "" },
    });
    await generateQuestions(db, ai, customer, id);
    await finishQuestions(db, ai, customer, id);
    await approveBrief(db, ai, customer, id, ["2026-12-01T16:00"], true);

    const view = await customerProject(db, customer, id);
    expect(view.matches.length).toBe(1);
    expect(view.project.access.parking).toBe("x");
    const job = await companyJob(db, owner, view.matches[0].id);
    expect(job.project.visit_windows).toEqual(["2026-12-01T16:00"]);
    const stored = await readFile(db, owner, false, file.id);
    expect([...stored.data]).toEqual([...bytes]);
  });
});
