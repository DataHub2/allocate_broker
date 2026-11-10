"use client";

import { useState } from "react";
import { ActionForm, Check, Choice, Field, SelectField, type FormState } from "./forms";

const YES_NO = [{ value: "ja", label: "Ja" }, { value: "nej", label: "Nej" }];
const YES_NO_SV = [{ value: "Ja", label: "Ja" }, { value: "Nej", label: "Nej" }];

export function BasicsForm({ action, defaults }: { action: (s: FormState, d: FormData) => Promise<FormState>; defaults: { name: string } }) {
  const [housing, setHousing] = useState("");
  const needsApproval = housing === "bostadsratt" || housing === "annat";
  return (
    <ActionForm action={action} submit="Fortsätt till frågorna" pendingText="Läser din beskrivning och dina bilder. Det kan ta upp till en minut.">
      <section className="form-section">
        <h2>Var ligger jobbet?</h2>
        <Field name="street_address" label="Gatuadress" autoComplete="street-address" help="Visas bara för företag du väljer att gå vidare med." />
        <div className="two">
          <Field name="postal_code" label="Postnummer" inputMode="numeric" autoComplete="postal-code" />
          <Field name="city" label="Ort" autoComplete="address-level2" help="Företagen ser orten." />
        </div>
        <div className="two">
          <Field name="contact_name" label="Ditt namn" autoComplete="name" defaultValue={defaults.name} />
          <Field name="phone" label="Telefon" inputMode="tel" autoComplete="tel" help="Visas bara för företag du väljer." />
        </div>
      </section>

      <section className="form-section">
        <h2>Bostaden</h2>
        <Choice
          name="housing_type" label="Boendeform" onChange={setHousing}
          options={[{ value: "villa", label: "Villa" }, { value: "radhus", label: "Radhus" }, { value: "bostadsratt", label: "Bostadsrätt" }, { value: "fritidshus", label: "Fritidshus" }, { value: "annat", label: "Annat" }]}
        />
        <Field name="year_built" label="Byggår" inputMode="numeric" help="Äldre hus kan ha asbest, gamla rör och ojordad el." />
        <Check name="year_unknown" label="Jag vet inte byggåret" />
      </section>

      <section className="form-section">
        <h2>Hur långt har du kommit?</h2>
        <Choice
          name="readiness" label="Var står du i dag?" help="Hantverkare lägger tid på att åka hem till dig. Det här hjälper dem att prioritera rätt."
          options={[
            { value: "ready_to_hire", label: "Jag vill anlita någon om priset är rimligt" },
            { value: "comparing", label: "Jag jämför och bestämmer mig senare" },
            { value: "price_only", label: "Jag vill bara veta ungefär vad det kostar", help: "Då får du en prisbild direkt och inga företag kontaktar dig." },
          ]}
        />
        <Choice name="is_decision_maker" label="Kan du fatta beslutet själv?" help="Svara nej om någon mer måste säga ja, till exempel en partner." options={YES_NO} />
        {needsApproval && (
          <Choice
            name="approval_status" label="Har föreningen eller hyresvärden godkänt arbetet?" help="Utan godkännande kan jobbet stoppas."
            options={[{ value: "approved", label: "Ja" }, { value: "pending", label: "Väntar på svar" }, { value: "not_asked", label: "Inte frågat ännu" }, { value: "not_needed", label: "Behövs inte" }, { value: "unknown", label: "Vet inte" }]}
          />
        )}
        <Choice name="financing_status" label="Är pengarna klara?" help="Företagen ser svaret, inte beloppet." options={[{ value: "ready", label: "Ja" }, { value: "needs_loan", label: "Behöver lån" }, { value: "unknown", label: "Vet inte" }]} />
        <Choice
          name="price_model" label="Hur vill du betala?"
          options={[
            { value: "fixed", label: "Fast pris", help: "Du vet slutpriset innan jobbet börjar." },
            { value: "running", label: "Löpande räkning", help: "Du betalar för den tid och det material som går åt." },
            { value: "either", label: "Vet inte" },
          ]}
        />
        <SelectField name="desired_start" label="När ska jobbet börja?" options={["Så snart som möjligt", "Inom 1 månad", "Inom 3 månader", "Inom 6 månader", "Senare", "Inte bestämt"].map((v) => ({ value: v, label: v }))} />
        <Choice name="wants_rot" label="Vill du använda ROT-avdrag?" help="Du betalar då 30 procent mindre för arbetet, upp till 50 000 kronor per person och år." options={YES_NO} />
        <SelectField name="budget_band" label="Budget, om du har en" options={["Under 50 000 kr", "50 000 till 150 000 kr", "150 000 till 300 000 kr", "300 000 till 600 000 kr", "Över 600 000 kr"].map((v) => ({ value: v, label: v }))} />
      </section>

      <section className="form-section">
        <h2>Så kommer man till jobbet</h2>
        <Field name="floor" label="Vilken våning?" inputMode="numeric" help="Hantverkaren behöver veta om material ska bäras i trappor." />
        <Choice name="elevator" label="Finns hiss?" options={YES_NO_SV} />
        <Choice name="parking" label="Var kan man parkera?" help="Styr hur långt verktyg och material ska bäras." options={["På tomten", "På gatan inom 50 meter", "Längre bort"].map((v) => ({ value: v, label: v }))} />
        <Choice name="container" label="Finns plats för container eller byggsäckar?" help="Rivningsmaterial behöver kunna stå någonstans." options={[...YES_NO_SV, { value: "Vet inte", label: "Vet inte" }]} />
        <Choice name="occupied" label="Bor ni kvar under arbetet?" help="Påverkar hur arbetet kan planeras." options={YES_NO_SV} />
        <Choice name="water_wc" label="Finns vatten och toalett som kan användas?" help="Behövs under arbetsdagarna." options={YES_NO_SV} />
        <Choice name="pets" label="Finns husdjur?" help="Bra att veta inför besöket." options={YES_NO_SV} />
        <Field name="blocked_hours" label="Tider då det inte får arbetas" help="Till exempel föreningens regler om tysta timmar. Valfritt." />
      </section>
      <p className="help">När du går vidare skickas din beskrivning och dina bilder till AI-tjänsten DeepSeek i Kina, för att skapa frågorna. Namn, adress och telefonnummer tas bort ur texten först. <a href="/integritet">Läs mer om hur vi hanterar dina uppgifter.</a></p>
    </ActionForm>
  );
}
