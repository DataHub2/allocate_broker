import { newPasswordAction } from "@/app/actions";
import { ActionForm, Field } from "@/components/forms";
import { AppPage } from "@/components/site";

export const metadata = { title: "Nytt lösenord | Allocate" };

export default async function NewPasswordPage({ searchParams }: { searchParams: Promise<{ kod?: string }> }) {
  const { kod } = await searchParams;
  return (
    <AppPage narrow>
      <div className="auth">
        <div className="page-head"><h1>Välj ett nytt lösenord</h1></div>
        <ActionForm action={newPasswordAction} submit="Spara lösenord" pendingText="Sparar.">
          <input type="hidden" name="token" value={kod ?? ""} />
          <Field name="password" label="Nytt lösenord" type="password" autoComplete="new-password" help="Minst 10 tecken." />
        </ActionForm>
      </div>
    </AppPage>
  );
}
