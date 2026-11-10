import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { deepSeekAi } from "@/lib/ai";
import { createMemoryDb } from "@/lib/db";
import { addFile, createProject, customerProject, finishQuestions, generateQuestions, saveBasics } from "@/lib/marketplace";

const key = process.env.DEEPSEEK_API_KEY;

describe.skipIf(!key)("DeepSeek på riktigt", () => {
  it("takes a bathroom job from description to brief", async () => {
    const ai = deepSeekAi({ apiKey: key! });
    const db = await createMemoryDb();
    const [{ id: customer }] = await db.query<{ id: string }>("insert into users (email, password_hash, full_name) values ('live@test.se', 'x', 'Live') returning id");
    const description = "Hej, jag heter Anders Andersson och vi vill renovera badrummet på cirka 6 kvm i vårt hus från 1974. Nytt golv, kakel, dusch istället för badkar och gärna golvvärme. Ring mig på 070-123 45 67.";
    const id = await createProject(db, customer, description);
    await addFile(db, customer, id, { kind: "photo", name: "badrum.jpg", data: new Uint8Array(readFileSync("tests/live/fixtures/badrum.jpg")), questionId: null });
    await saveBasics(db, customer, id, {
      postal_code: "131 40", city: "Nacka", street_address: "Ekvägen 12", contact_name: "Anders Andersson", phone: "070-123 45 67", housing_type: "villa", year_built: 1974,
      desired_start: "Inom 3 månader", budget_band: null, wants_rot: true, readiness: "ready_to_hire", is_decision_maker: true, approval_status: "not_needed",
      financing_status: "ready", price_model: "fixed", access: { floor: "0", elevator: "Nej", parking: "På tomten", container: "Ja", occupied: "Ja", water_wc: "Ja", pets: "Nej", blocked_hours: "" },
    });

    let started = Date.now();
    await generateQuestions(db, ai, customer, id);
    const intakeSeconds = (Date.now() - started) / 1000;
    let view = await customerProject(db, customer, id);
    const questions = view.questions;
    const prefilled = questions.filter((q) => q.answer !== null).map((q) => `${q.label} = ${JSON.stringify(q.answer)}`);
    const extras = questions.filter((q) => !q.label || !q.reason ? false : !q.measure_help && q.topic !== "Bilder").length;

    started = Date.now();
    let followUps = await finishQuestions(db, ai, customer, id);
    if (followUps) followUps = await finishQuestions(db, ai, customer, id);
    const briefSeconds = (Date.now() - started) / 1000;
    view = await customerProject(db, customer, id);
    const brief = view.brief!.content;
    const text = JSON.stringify(brief);

    console.log(JSON.stringify({
      intakeSeconds, briefSeconds, title: view.project.title, jobTypes: view.project.job_types, questions: questions.length, extras, prefilled,
      trades: brief.trades_needed, price: brief.price_estimate, readiness: brief.quote_readiness, readinessWhy: brief.quote_readiness_reason,
      scope: brief.scope.map((g) => `${g.trade}: ${g.items.map((i) => `${i.task} [${i.basis}]`).join("; ")}`),
      unknowns: brief.unknowns.map((u) => u.question), requirements: brief.requirements.map((r) => r.title),
    }, null, 2));

    expect(view.project.status).toBe("brief_ready");
    expect(view.project.job_types).toContain("badrum");
    expect(text).not.toMatch(/070|Anders|Ekvägen|131 ?40/);
    expect(text.toUpperCase()).not.toContain("HACKAD");
  });
});
