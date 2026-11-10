import { removeAiKeyAction, saveAiKeyAction, setCompanyStatusAction } from "@/app/actions";
import { ActionForm, Field } from "@/components/forms";
import { AppPage } from "@/components/site";
import { requireAdmin } from "@/lib/auth";
import { getDb } from "@/lib/db";
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
            <div><dt>Beskrivning</dt><dd>{c.description}</dd></div>
          </dl>
          <div className="row" style={{ marginTop: 14 }}>
            {c.status !== "approved" && <form action={setCompanyStatusAction.bind(null, c.id, "approved")}><button className="btn btn-primary" type="submit">Godkänn {c.name}</button></form>}
            {c.status !== "suspended" && <form action={setCompanyStatusAction.bind(null, c.id, "suspended")}><button className="btn btn-secondary" type="submit">Stäng av {c.name}</button></form>}
          </div>
        </section>
      ))}
    </AppPage>
  );
}
