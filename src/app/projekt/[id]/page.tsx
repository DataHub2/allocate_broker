import { notFound } from "next/navigation";
import { acceptQuoteAction, approveBriefAction, confirmVisitAction, declineQuoteAction, declineVisitAction, saveBasicsAction, switchToQuotesAction } from "@/app/actions";
import { BasicsForm } from "@/components/basics-form";
import { ApproveForm, BriefEditor, QuestionsForm, Uploader } from "@/components/client";
import { ActionForm, SelectField } from "@/components/forms";
import { AppPage, Progress } from "@/components/site";
import { requireUser } from "@/lib/auth";
import { CONFIDENCE_LABEL, formatSek, formatSlot, READINESS_LABEL, type Brief } from "@/lib/brief";
import { getDb } from "@/lib/db";
import { TRADE_LABEL } from "@/lib/job-requirements";
import { customerProject, NotFound, type MatchView } from "@/lib/marketplace";

export const metadata = { title: "Mitt jobb | Allocate" };
export const maxDuration = 300;

const DECLINE_REASONS = ["Priset var för högt", "Tiden passade inte", "Valde ett annat företag", "Jag skjuter upp jobbet", "Annat"].map((v) => ({ value: v, label: v }));

function PriceBlock({ brief }: { brief: Brief }) {
  return (
    <section className="price dark" aria-labelledby="pris">
      <h3 id="pris">Preliminär bedömning, inte en offert.</h3>
      <strong>{formatSek(brief.price_estimate.low_sek)} till {formatSek(brief.price_estimate.high_sek)}</strong>
      <p>{CONFIDENCE_LABEL[brief.price_estimate.confidence]}. {brief.price_estimate.basis}</p>
    </section>
  );
}

function BriefExtras({ brief }: { brief: Brief }) {
  return (
    <>
      {brief.unknowns.length > 0 && (
        <section className="panel">
          <h3>Det här är oklart</h3>
          <ul>{brief.unknowns.map((u) => <li className="list-row" key={u.question}><div><p><strong>{u.question}</strong></p><p>{u.why_it_matters}{u.needs_site_visit ? " Behöver ses på plats." : ""}</p></div></li>)}</ul>
        </section>
      )}
      {brief.requirements.length > 0 && (
        <section className="panel">
          <h3>Att kontrollera</h3>
          <ul>{brief.requirements.map((r) => <li className="list-row" key={r.title}><div><p><strong>{r.title}</strong></p><p>{r.detail}</p></div></li>)}</ul>
        </section>
      )}
    </>
  );
}

function Compare({ matches, projectId, brief }: { matches: MatchView[]; projectId: string; brief: Brief }) {
  const quoted = matches.filter((m) => m.quote);
  if (!quoted.length) return null;
  const rows = brief.scope.flatMap((g) => g.items.map((item, i) => ({ ref: `${g.trade}:${i}`, task: item.task, trade: g.trade })));
  return (
    <section style={{ marginTop: 40 }}>
      <h2>Offerter</h2>
      <div className="table-scroll" role="region" aria-label="Jämförelse av offerter" tabIndex={0}>
        <table>
          <caption>Samma rader, sida vid sida. Belopp inklusive moms.</caption>
          <thead><tr><th scope="col">Moment</th>{quoted.map((m) => <th scope="col" className="num" key={m.id}>{m.company_name}</th>)}</tr></thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.ref}>
                <th scope="row">{r.task}<br /><small>{TRADE_LABEL[r.trade]}</small></th>
                {quoted.map((m) => {
                  const item = m.quote!.items.find((i) => i.ref === r.ref);
                  return <td className="num" key={m.id}>{item ? formatSek(item.amount_sek) : "Ingår inte"}</td>;
                })}
              </tr>
            ))}
            <tr className="total"><th scope="row">Summa</th>{quoted.map((m) => <td className="num" key={m.id}>{formatSek(m.quote!.total_sek)}</td>)}</tr>
            <tr><th scope="row">ROT-avdrag</th>{quoted.map((m) => <td className="num" key={m.id}>{formatSek(m.quote!.rot_sek)}</td>)}</tr>
            <tr className="total"><th scope="row">Du betalar</th>{quoted.map((m) => <td className="num" key={m.id}>{formatSek(m.quote!.total_sek - m.quote!.rot_sek)}</td>)}</tr>
            <tr><th scope="row">Prismodell</th>{quoted.map((m) => <td className="num" key={m.id}>{m.quote!.price_model === "fixed" ? "Fast pris" : "Löpande"}</td>)}</tr>
            <tr><th scope="row">Start</th>{quoted.map((m) => <td className="num" key={m.id}>{m.quote!.start_text}</td>)}</tr>
            <tr><th scope="row">Tid</th>{quoted.map((m) => <td className="num" key={m.id}>{m.quote!.duration_text}</td>)}</tr>
          </tbody>
        </table>
      </div>
      {quoted.map((m) => (
        <section className="company" key={m.id}>
          <h3>{m.company_name}</h3>
          {m.quote!.terms && <p><strong>Villkor:</strong> {m.quote!.terms}</p>}
          <p>Offerten gäller till {m.quote!.valid_until}.</p>
          {m.status === "quoted" ? (
            <div className="stack" style={{ marginTop: 16 }}>
              <form action={acceptQuoteAction.bind(null, projectId, m.id)}><button className="btn btn-primary" type="submit">Välj {m.company_name}</button></form>
              <ActionForm action={declineQuoteAction.bind(null, projectId, m.id)} submit={`Tacka nej till ${m.company_name}`} submitClass="btn btn-secondary" pendingText="Skickar svaret.">
                <SelectField name="reason" label="Varför tackar du nej?" help="Företaget får se anledningen." options={DECLINE_REASONS} />
              </ActionForm>
            </div>
          ) : <p className="tag">{m.status === "won" ? "Du valde det här företaget" : "Du tackade nej"}</p>}
        </section>
      ))}
    </section>
  );
}

export default async function ProjectPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUser(`/projekt/${id}`);
  const view = await customerProject(await getDb(), user.id, id).catch((error) => {
    if (error instanceof NotFound) notFound();
    throw error;
  });
  const { project, questions, files, brief, matches } = view;

  if (project.status === "draft") {
    return (
      <AppPage narrow>
        <div className="page-head">
          <Progress step={1} label="Grundfakta" />
          <h1>Berätta om bostaden</h1>
          <p>Du skrev: {view.private.description}</p>
        </div>
        <section className="panel" style={{ marginTop: 0, marginBottom: 28 }}>
          <h2 style={{ fontSize: "1.7rem" }}>Bilder och ritningar</h2>
          <Uploader projectId={id} initial={files.filter((f) => f.kind === "photo" && !f.question_id)} label="Lägg till bilder" />
          <div style={{ marginTop: 16 }}><Uploader projectId={id} kind="drawing" initial={files.filter((f) => f.kind === "drawing")} label="Lägg till ritning" /></div>
        </section>
        <BasicsForm action={saveBasicsAction.bind(null, id)} defaults={{ name: user.full_name }} />
      </AppPage>
    );
  }

  if (project.status === "questions") {
    return (
      <AppPage narrow>
        <div className="page-head">
          <Progress step={2} label="Frågor om jobbet" />
          <h1>{project.title}</h1>
          <p>Det här behöver hantverkaren veta för att kunna räkna. Allt sparas medan du fyller i.</p>
        </div>
        <QuestionsForm projectId={id} questions={questions} files={files} />
      </AppPage>
    );
  }

  if (!brief) notFound();

  if (project.status === "brief_ready") {
    const priceOnly = project.readiness === "price_only";
    return (
      <AppPage narrow>
        <div className="page-head">
          <Progress step={3} label="Underlag" />
          <h1>Stämmer det här?</h1>
          <p>Rader märkta Antagande är våra gissningar. Ändra det som inte stämmer.</p>
        </div>
        <BriefEditor projectId={id} initial={brief.content} />
        <PriceBlock brief={brief.content} />
        <BriefExtras brief={brief.content} />
        <section className="section" style={{ paddingBottom: 0 }}>
          {priceOnly ? (
            <>
              <h2>Nu vet du ungefär vad det kostar</h2>
              <p style={{ marginBlock: "12px 20px" }}>Inga företag har kontaktats. Vill du ha riktiga offerter går det att skicka vidare.</p>
              <form action={switchToQuotesAction.bind(null, id)}><button type="submit" className="btn btn-primary">Jag vill ha offerter</button></form>
            </>
          ) : (
            <>
              <Progress step={4} label="Godkänn" />
              <h2 style={{ marginBottom: 20 }}>Skicka till företag</h2>
              <p style={{ marginBottom: 20 }}>{READINESS_LABEL[brief.content.quote_readiness]}. {brief.content.quote_readiness_reason}</p>
              <ApproveForm action={approveBriefAction.bind(null, id)} />
            </>
          )}
        </section>
      </AppPage>
    );
  }

  const active = matches.filter((m) => m.status !== "declined");
  return (
    <AppPage>
      <div className="page-head">
        <h1>{project.title}</h1>
        <p>{project.status === "awarded" ? "Du har valt företag." : active.length ? `Underlaget är skickat till ${active.length} ${active.length === 1 ? "företag" : "företag"}.` : "Vi letar efter företag som passar jobbet. Du ser dem här så snart de är klara."}</p>
      </div>
      {active.length > 0 && (
        <section>
          <h2>Företagen</h2>
          {active.map((m) => (
            <section className="company" key={m.id}>
              <h3>{m.company_name}</h3>
              <p className="tag">Org.nr {m.org_number}, {m.trades.map((t) => TRADE_LABEL[t].toLowerCase()).join(", ")}</p>
              <p>{m.company_description}</p>
              <p style={{ marginTop: 8 }}><strong>Därför detta företag:</strong> {m.reasons.join(". ")}.</p>
              {m.visit?.status === "requested" && (
                <div className="panel">
                  <h4 className="label">Vill komma på besök {formatSlot(m.visit.slot)}</h4>
                  {m.visit.note && <p>{m.visit.note}</p>}
                  <p className="help" style={{ marginTop: 8 }}>Om du godkänner får företaget din adress och ditt telefonnummer.</p>
                  <div className="row">
                    <form action={confirmVisitAction.bind(null, id, m.id)}><button className="btn btn-primary" type="submit">Godkänn besöket</button></form>
                    <form action={declineVisitAction.bind(null, id, m.id)}><button className="btn btn-secondary" type="submit">Avböj besöket</button></form>
                  </div>
                </div>
              )}
              {m.visit?.status === "confirmed" && <p className="tag" style={{ marginTop: 8 }}>Besök {formatSlot(m.visit.slot)}</p>}
            </section>
          ))}
        </section>
      )}
      <Compare matches={active} projectId={id} brief={brief.content} />
    </AppPage>
  );
}
