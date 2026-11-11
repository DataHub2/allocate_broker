import { addCompanyAction, companyInviteAction, removeAiKeyAction, saveAiKeyAction, setCompanyStatusAction } from "@/app/actions";
import { ActionForm, Check, Choice, Field } from "@/components/forms";
import { AppPage } from "@/components/site";
import { requireAdmin } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { TRADE_LABEL, TRADES } from "@/lib/job-requirements";
import { listCompanies } from "@/lib/marketplace";
import { deepSeekKey, DEEPSEEK_SECRET, hasUnreadableSecret } from "@/lib/settings";

export const metadata = { title: "Admin | Allocate" };
export const maxDuration = 120;

const STATUS: Record<string, string> = { pending: "Väntar", approved: "Godkänt", suspended: "Avstängt" };

export default async function Admin() {
  await requireAdmin();
  const db = await getDb();
  const companies = await listCompanies(db);
  const key = await deepSeekKey(db);
  const unreadable = await hasUnreadableSecret(db, DEEPSEEK_SECRET);
  return (
    <AppPage>
      <section className="panel" aria-labelledby="ai-nyckel" style={{ marginTop: 32 }}>
        <h2 id="ai-nyckel" style={{ fontSize: "2rem" }}>AI-nyckel</h2>
        <p style={{ marginBottom: 16 }}>
          {key?.source === "admin" && <>DeepSeek är kopplat. Nyckeln slutar på <strong>{key.key.slice(-4)}</strong>.</>}
          {key?.source === "server" && <>DeepSeek är kopplat via serverns inställningar. En nyckel du sparar här används i stället.</>}
          {!key && !unreadable && <>Ingen nyckel är sparad. Utan nyckel kan kunderna inte få frågor eller underlag.</>}
          {unreadable && <>Den sparade nyckeln går inte att läsa längre, troligen för att databasadressen har ändrats. Spara den igen.</>}
        </p>
        <ActionForm action={saveAiKeyAction} submit={key ? "Byt nyckel" : "Spara nyckel"} pendingText="Kontrollerar nyckeln hos DeepSeek.">
          <Field name="deepseek_key" label="Nyckel från DeepSeek" type="password" autoComplete="off" help="Skapa en på platform.deepseek.com under API keys. Den sparas krypterad och visas aldrig igen här." />
        </ActionForm>
        {key?.source === "admin" && (
          <form action={removeAiKeyAction} style={{ marginTop: 12 }}><button type="submit" className="btn-text">Ta bort nyckeln</button></form>
        )}
      </section>
      <div className="page-head"><h1>Företag</h1><p>Kontrollera F-skatt, försäkring och registreringsnummer innan du godkänner ett företag.</p></div>
      <section className="panel" aria-labelledby="lagg-till" style={{ marginBottom: 32 }}>
        <h2 id="lagg-till" style={{ fontSize: "2rem" }}>Lägg till företag</h2>
        <p style={{ marginBottom: 16 }}>För företag du redan har pratat med. De blir godkända direkt och slipper ansökan. Du får en länk att skicka, där de väljer sitt lösenord.</p>
        <ActionForm action={addCompanyAction} submit="Lägg till och godkänn" pendingText="Lägger till företaget och letar efter jobb som passar.">
          <Field name="name" label="Företagsnamn" autoComplete="off" />
          <Field name="org_number" label="Organisationsnummer" inputMode="numeric" help="Tio siffror." />
          <Field name="contact_name" label="Kontaktperson" autoComplete="off" />
          <Field name="email" label="Kontaktpersonens e-post" type="email" autoComplete="off" help="Blir inloggningen för företaget." />
          <Choice name="trades" multiple label="Yrken" options={TRADES.map((t) => ({ value: t, label: TRADE_LABEL[t] }))} />
          <Field name="postal_prefixes" label="Områden de arbetar i" help="De två första siffrorna i postnumret, med kommatecken emellan. Till exempel 11, 12, 13." />
          <Field name="el_registration" label="Registreringsnummer hos Elsäkerhetsverket" help="Bara om de gör elarbete." />
          <Check name="checked" label="Jag har kontrollerat F-skatt och ansvarsförsäkring" />
        </ActionForm>
      </section>
      {companies.length === 0 && <p>Inga företag har ansökt ännu.</p>}
      {companies.map((c) => (
        <section className="company" key={c.id}>
          <h2 style={{ fontSize: "1.8rem" }}>{c.name}</h2>
          <p className="tag">{STATUS[c.status]}</p>
          <dl className="facts" style={{ marginTop: 12 }}>
            <div><dt>Org.nr</dt><dd>{c.org_number}</dd></div>
            <div><dt>E-post</dt><dd>{c.email}</dd></div>
            <div><dt>Yrken</dt><dd>{c.trades.join(", ")}</dd></div>
            <div><dt>Områden</dt><dd>{c.postal_prefixes.join(", ")}</dd></div>
            <div><dt>Elregistrering</dt><dd>{c.el_registration ?? "Saknas"}</dd></div>
            <div><dt>Våtrum</dt><dd>{c.wetroom_cert ?? "Saknas"}</dd></div>
            {c.description && <div><dt>Beskrivning</dt><dd>{c.description}</dd></div>}
          </dl>
          <div className="row" style={{ marginTop: 14 }}>
            {c.status !== "approved" && <form action={setCompanyStatusAction.bind(null, c.id, "approved")}><button className="btn btn-primary" type="submit">Godkänn {c.name}</button></form>}
            {c.status !== "suspended" && <form action={setCompanyStatusAction.bind(null, c.id, "suspended")}><button className="btn btn-secondary" type="submit">Stäng av {c.name}</button></form>}
          </div>
          <div style={{ marginTop: 10 }}>
            <ActionForm action={companyInviteAction.bind(null, c.id)} submit={`Ny inloggningslänk för ${c.name}`} submitClass="btn-text" pendingText="Skapar länken.">{null}</ActionForm>
          </div>
        </section>
      ))}
    </AppPage>
  );
}
