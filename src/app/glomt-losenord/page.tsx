import { forgotPasswordAction } from "@/app/actions";
import { ActionForm, Field } from "@/components/forms";
import { AppPage } from "@/components/site";

export const metadata = { title: "Glömt lösenord | Allocate" };

export default function ForgotPage() {
  return (
    <AppPage narrow>
      <div className="auth">
        <div className="page-head"><h1>Glömt lösenordet?</h1><p>Skriv din e-postadress, så skickar vi en länk.</p></div>
        <ActionForm action={forgotPasswordAction} submit="Skicka länk" pendingText="Skickar.">
          <Field name="email" label="E-post" type="email" autoComplete="email" />
        </ActionForm>
      </div>
    </AppPage>
  );
}
