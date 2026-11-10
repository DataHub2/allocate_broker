import Link from "next/link";
import { signUpAction } from "@/app/actions";
import { NewProject } from "@/components/client";
import { ActionForm, Field } from "@/components/forms";
import { AppPage } from "@/components/site";
import { currentUser } from "@/lib/auth";

export const metadata = { title: "Nytt jobb | Allocate" };

export default async function NewProjectPage() {
  const user = await currentUser();
  return (
    <AppPage narrow>
      {user ? (
        <>
          <div className="page-head"><h1>Nytt jobb</h1></div>
          <NewProject />
        </>
      ) : (
        <div className="auth">
          <div className="page-head"><h1>Skapa ett konto så sparas ditt jobb</h1><p>Det är gratis för dig som beställer.</p></div>
          <ActionForm action={signUpAction} submit="Skapa konto och fortsätt" pendingText="Skapar kontot.">
            <input type="hidden" name="next" value="/nytt-projekt" />
            <Field name="full_name" label="Namn" autoComplete="name" />
            <Field name="email" label="E-post" type="email" autoComplete="email" />
            <Field name="password" label="Lösenord" type="password" autoComplete="new-password" help="Minst 10 tecken." />
          </ActionForm>
          <p style={{ marginTop: 20 }}><Link href="/logga-in?nasta=/nytt-projekt">Jag har redan ett konto</Link></p>
        </div>
      )}
    </AppPage>
  );
}
