import { applyCompanyAction } from "@/app/actions";
import { ActionForm, Check, Choice, Field, TextArea } from "@/components/forms";
import { AppPage } from "@/components/site";
import { currentUser } from "@/lib/auth";
import { TRADE_LABEL, TRADES } from "@/lib/job-requirements";

export const metadata = { title: "Ansök som företag | Allocate" };

export default async function Apply() {
  const user = await currentUser();
  return (
    <AppPage narrow>
      <div className="page-head">
        <h1>Ansök som företag</h1>
        <p>Vi kontrollerar uppgifterna innan företaget godkänns. Sedan får du jobb som passar era yrken och områden.</p>
      </div>
      <ActionForm action={applyCompanyAction} submit="Skicka ansökan" pendingText="Skickar ansökan.">
        {!user && (
          <section className="form-section">
            <h2>Ditt konto</h2>
            <Field name="full_name" label="Ditt namn" autoComplete="name" />
            <Field name="email" label="E-post" type="email" autoComplete="email" />
            <Field name="password" label="Lösenord" type="password" autoComplete="new-password" help="Minst 10 tecken." />
          </section>
        )}
        <section className="form-section">
          <h2>Företaget</h2>
          <Field name="name" label="Företagsnamn" autoComplete="organization" />
          <Field name="org_number" label="Organisationsnummer" inputMode="numeric" help="Tio siffror." />
          <TextArea name="description" label="Vad är ni bra på?" help="Skriv konkret. Texten används för att hitta jobb som passar er och visas för kunden." />
          <Choice name="trades" multiple label="Yrken" options={TRADES.map((t) => ({ value: t, label: TRADE_LABEL[t] }))} />
          <Field name="postal_prefixes" label="Områden ni arbetar i" help="De två första siffrorna i postnumret, med kommatecken emellan. Till exempel 11, 12, 13." />
          <Field name="min_job_sek" label="Minsta jobb ni tar, i kronor" inputMode="numeric" help="Lämna tomt om ni tar alla storlekar." />
        </section>
        <section className="form-section">
          <h2>Behörighet</h2>
          <Field name="el_registration" label="Registreringsnummer hos Elsäkerhetsverket" help="Krävs om ni utför elarbete." />
          <Field name="wetroom_cert" label="Våtrumsbehörighet" help="Till exempel Säker Vatten, BBV, GVK eller MVK, med certifikatnummer. Valfritt." />
          <Check name="has_f_skatt" label="Företaget har F-skatt" />
          <Check name="has_insurance" label="Företaget har ansvarsförsäkring" />
        </section>
      </ActionForm>
    </AppPage>
  );
}
