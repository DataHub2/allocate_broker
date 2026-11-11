import { newPasswordAction } from "@/app/actions";
import { ActionForm, Field } from "@/components/forms";
import { AppPage } from "@/components/site";

export const metadata = { title: "Nytt lösenord | Allocate" };

export default async function NewPasswordPage({ searchParams }: { searchParams: Promise<{ kod?: string; valkommen?: string }> }) {
  const { kod, valkommen } = await searchParams;
  const invited = valkommen === "1";
  return (
    <AppPage narrow>
      <div className="auth">
        <div className="page-head">
          <h1>{invited ? "Välj ett lösenord" : "Välj ett nytt lösenord"}</h1>
          {invited && <p>Välkommen till Allocate. Företaget är redan godkänt. När du har valt lösenord kommer du till inkorgen med jobb.</p>}
        </div>
        <ActionForm action={newPasswordAction} submit="Spara lösenord" pendingText="Sparar.">
          <input type="hidden" name="token" value={kod ?? ""} />
          <input type="hidden" name="next" value={invited ? "/foretag" : "/mina-projekt"} />
          <Field name="password" label={invited ? "Lösenord" : "Nytt lösenord"} type="password" autoComplete="new-password" help="Minst 10 tecken." />
        </ActionForm>
      </div>
    </AppPage>
  );
}
