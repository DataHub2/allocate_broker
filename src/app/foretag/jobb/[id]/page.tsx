import { notFound } from "next/navigation";
import { declineJobAction, requestVisitAction, submitQuoteAction } from "@/app/actions";
import { QuoteForm } from "@/components/client";
import { ActionForm, Choice, SelectField, TextArea } from "@/components/forms";
import { AppPage } from "@/components/site";
import { requireUser } from "@/lib/auth";
import { BASIS_LABEL, CONFIDENCE_LABEL, formatSek, formatSlot, READINESS_LABEL, ROT } from "@/lib/brief";
import { getDb } from "@/lib/db";
import { TRADE_LABEL } from "@/lib/job-requirements";
import { companyJob, NotFound } from "@/lib/marketplace";

export const metadata = { title: "Jobb | Allocate" };

const READINESS: Record<string, string> = { ready_to_hire: "Vill anlita någon om priset är rimligt", comparing: "Jämför och bestämmer sig senare" };
const APPROVAL: Record<string, string> = { approved: "Godkänt", pending: "Väntar på svar", not_asked: "Inte frågat ännu", not_needed: "Behövs inte", unknown: "Vet inte" };
const FINANCING: Record<string, string> = { ready: "Klara", needs_loan: "Behöver lån", unknown: "Vet inte" };
const PRICE: Record<string, string> = { fixed: "Fast pris", running: "Löpande räkning", either: "Vet inte" };
const HOUSING: Record<string, string> = { villa: "Villa", radhus: "Radhus", bostadsratt: "Bostadsrätt", fritidshus: "Fritidshus", annat: "Annat" };
const SUPPLIED: Record<string, string> = { contractor: "Företaget", customer: "Kunden", unclear: "Oklart" };
const DECLINE = ["Hinner inte", "För litet jobb", "För långt bort", "Underlaget räcker inte", "Passar inte oss"].map((v) => ({ value: v, label: v }));

export default async function CompanyJobPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUser(`/foretag/jobb/${id}`);
  const job = await companyJob(await getDb(), user.id, id).catch((error) => {
    if (error instanceof NotFound) notFound();
    throw error;
  });
  const { project, brief, match, stats, files, competitors, visit, quote, contact } = job;
  const closed = ["declined", "lost", "won"].includes(match.status);
  const canBook = ["invited", "viewed"].includes(match.status);
  const canQuote = !closed && match.status !== "quoted" && match.status !== "visit_requested";
  const a = project.access;

  return (
    <AppPage>
      <div className="page-head">
        <h1>{project.title}</h1>
        <p>{project.city}. {READINESS_LABEL[brief.quote_readiness]}. {brief.quote_readiness_reason}</p>
      </div>

      {match.status === "lost" && <p className="form-error">Jobbet gick inte till er. Kundens svar: {match.outcome_reason}</p>}
      {match.status === "won" && <p className="form-ok">Kunden valde er offert.</p>}

      <div className="split" style={{ gridTemplateColumns: undefined }}>
        <section aria-labelledby="beslut">
          <h2 id="beslut" style={{ marginBottom: 14 }}>Innan du åker</h2>
          <dl className="facts">
            <div><dt>Kunden</dt><dd>{READINESS[project.readiness ?? ""]}</dd></div>
            <div><dt>Beslut</dt><dd>{project.is_decision_maker ? "Kan besluta själv" : "Någon mer måste säga ja"}</dd></div>
            <div><dt>Godkännande</dt><dd>{APPROVAL[project.approval_status ?? "unknown"]}</dd></div>
            <div><dt>Pengarna</dt><dd>{FINANCING[project.financing_status ?? "unknown"]}</dd></div>
            <div><dt>Betalning</dt><dd>{PRICE[project.price_model ?? "either"]}</dd></div>
            <div><dt>Start</dt><dd>{project.desired_start}</dd></div>
            <div><dt>Andra företag</dt><dd>{competitors === 0 ? "Inga just nu" : `${competitors} till räknar på jobbet`}</dd></div>
            <div><dt>Frågor besvarade</dt><dd>{stats.answered} av {stats.total}, {stats.unknown} markerade som okända</dd></div>
            <div><dt>Preliminär prisbild</dt><dd>{formatSek(brief.price_estimate.low_sek)} till {formatSek(brief.price_estimate.high_sek)}. {CONFIDENCE_LABEL[brief.price_estimate.confidence]}.</dd></div>
          </dl>
          <h3 style={{ marginTop: 28, marginBottom: 10 }}>På plats</h3>
          <dl className="facts">
            <div><dt>Bostad</dt><dd>{HOUSING[project.housing_type ?? "annat"]}{project.year_built ? `, byggd ${project.year_built}` : ", byggår okänt"}</dd></div>
            <div><dt>Våning och hiss</dt><dd>Våning {a.floor || "okänd"}, hiss: {a.elevator || "okänt"}</dd></div>
            <div><dt>Parkering</dt><dd>{a.parking || "Okänt"}</dd></div>
            <div><dt>Container</dt><dd>{a.container || "Okänt"}</dd></div>
            <div><dt>Bor kvar</dt><dd>{a.occupied || "Okänt"}</dd></div>
            <div><dt>Vatten och toalett</dt><dd>{a.water_wc || "Okänt"}</dd></div>
            <div><dt>Husdjur</dt><dd>{a.pets || "Okänt"}</dd></div>
            {a.blocked_hours && <div><dt>Får inte arbeta</dt><dd>{a.blocked_hours}</dd></div>}
          </dl>
        </section>

        <article className="doc" aria-labelledby="doc-t">
          <h2 id="doc-t" style={{ fontSize: "2rem" }}>{brief.title}</h2>
          <p>{brief.summary}</p>
          {brief.scope.map((group) => (
            <section key={group.trade}>
              <h3>{TRADE_LABEL[group.trade]}{match.trades.includes(group.trade) ? "" : " (inte ert yrke)"}</h3>
              <ul className="doc-items">
                {group.items.map((item, i) => (
                  <li key={i} className={item.basis === "assumption" ? "assumption" : undefined}>
                    <p className="doc-task">{item.task}{item.quantity && <span>, {item.quantity} {item.unit ?? ""}</span>}</p>
                    {item.detail && <p>{item.detail}</p>}
                    <p className="doc-meta"><span className="basis">{item.basis === "customer" ? "Från kunden" : BASIS_LABEL[item.basis]}</span></p>
                  </li>
                ))}
              </ul>
            </section>
          ))}
          {brief.unknowns.length > 0 && (
            <section>
              <h3>Oklart</h3>
              <ul className="plain">{brief.unknowns.map((u) => <li key={u.question}><strong>{u.question}</strong> {u.why_it_matters}{u.needs_site_visit ? " Behöver ses på plats." : ""}</li>)}</ul>
            </section>
          )}
          {brief.materials.length > 0 && (
            <section>
              <h3>Material</h3>
              <ul className="plain">{brief.materials.map((m) => <li key={m.item}>{m.item}. Köps av: {SUPPLIED[m.supplied_by]}</li>)}</ul>
            </section>
          )}
          {brief.requirements.length > 0 && (
            <section>
              <h3>Att kontrollera</h3>
              <ul className="plain">{brief.requirements.map((r) => <li key={r.title}><strong>{r.title}.</strong> {r.detail}</li>)}</ul>
            </section>
          )}
        </article>
      </div>

      {files.length > 0 && (
        <section style={{ marginTop: 40 }}>
          <h2 style={{ marginBottom: 14 }}>Bilder och ritningar</h2>
          <div className="photos">
            {files.map((f, i) => f.kind === "photo" ? (
              <figure key={f.id}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={`/api/filer/${f.id}`} alt={f.task ?? `Bild ${i + 1} från kunden`} />
                {f.task && <figcaption>{f.task}</figcaption>}
              </figure>
            ) : <a key={f.id} href={`/api/filer/${f.id}`}>Ladda ner ritning: {f.name}</a>)}
          </div>
        </section>
      )}

      {contact && (
        <section className="panel">
          <h2 style={{ fontSize: "1.8rem" }}>Kontakt</h2>
          <dl className="facts">
            <div><dt>Namn</dt><dd>{contact.contact_name}</dd></div>
            <div><dt>Adress</dt><dd>{contact.street_address}, {contact.postal_code}</dd></div>
            <div><dt>Telefon</dt><dd><a href={`tel:${contact.phone}`}>{contact.phone}</a></dd></div>
          </dl>
        </section>
      )}

      {visit && <p className="form-ok" style={{ marginTop: 28 }}>Besök {formatSlot(visit.slot)}: {visit.status === "requested" ? "väntar på kundens svar" : visit.status === "confirmed" ? "bekräftat" : "kunden avböjde tiden"}.</p>}

      {canBook && (
        <section className="panel">
          <h2 style={{ fontSize: "1.8rem" }}>Boka besök</h2>
          <ActionForm action={requestVisitAction.bind(null, id)} submit="Boka besök" submitClass="btn btn-primary" pendingText="Skickar förfrågan.">
            <Choice name="slot" label="Tider kunden kan" options={project.visit_windows.map((s) => ({ value: s, label: formatSlot(s) }))} />
            <TextArea name="note" label="Meddelande till kunden" rows={2} help="Valfritt." />
          </ActionForm>
        </section>
      )}

      {canQuote && (
        <section className="panel">
          <h2 style={{ fontSize: "1.8rem" }}>Lämna offert</h2>
          <QuoteForm action={submitQuoteAction.bind(null, id)} brief={brief} trades={match.trades} wantsRot={Boolean(project.wants_rot)} rotRate={ROT.rate} rotCap={ROT.capSek} />
        </section>
      )}

      {quote && (
        <section className="panel">
          <h2 style={{ fontSize: "1.8rem" }}>Din offert</h2>
          <dl className="facts">
            <div><dt>Summa</dt><dd>{formatSek(quote.total_sek)}</dd></div>
            <div><dt>Arbete</dt><dd>{formatSek(quote.labour_sek)}</dd></div>
            <div><dt>ROT-avdrag</dt><dd>{formatSek(quote.rot_sek)}</dd></div>
            <div><dt>Start</dt><dd>{quote.start_text}</dd></div>
          </dl>
        </section>
      )}

      {!closed && match.status !== "quoted" && (
        <section className="panel">
          <h2 style={{ fontSize: "1.8rem" }}>Tacka nej</h2>
          <ActionForm action={declineJobAction.bind(null, id)} submit="Tacka nej till jobbet" submitClass="btn btn-secondary" pendingText="Skickar svaret.">
            <SelectField name="reason" label="Varför?" options={DECLINE} />
          </ActionForm>
        </section>
      )}
    </AppPage>
  );
}
