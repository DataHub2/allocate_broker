import Link from "next/link";
import { redirect } from "next/navigation";
import { signInAction, signUpAction } from "@/app/actions";
import { ActionForm, Field } from "@/components/forms";
import { AppPage } from "@/components/site";
import { currentUser, safeNext } from "@/lib/auth";

export const metadata = { title: "Logga in | Allocate" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ nasta?: string; konto?: string }> }) {
  const { nasta, konto } = await searchParams;
  const next = safeNext(nasta);
  if (await currentUser()) redirect(next);
  const creating = konto === "1";
  const query = `nasta=${encodeURIComponent(next)}`;
  return (
    <AppPage narrow>
      <div className="auth">
        <div className="page-head"><h1>{creating ? "Skapa konto" : "Logga in"}</h1></div>
        {creating ? (
          <ActionForm action={signUpAction} submit="Skapa konto" pendingText="Skapar kontot.">
            <input type="hidden" name="next" value={next} />
            <Field name="full_name" label="Namn" autoComplete="name" />
            <Field name="email" label="E-post" type="email" autoComplete="email" />
            <Field name="password" label="Lösenord" type="password" autoComplete="new-password" help="Minst 10 tecken." />
          </ActionForm>
        ) : (
          <ActionForm action={signInAction} submit="Logga in" pendingText="Loggar in.">
            <input type="hidden" name="next" value={next} />
            <Field name="email" label="E-post" type="email" autoComplete="email" />
            <Field name="password" label="Lösenord" type="password" autoComplete="current-password" />
          </ActionForm>
        )}
        <p style={{ marginTop: 20 }}>
          {creating ? <Link href={`/logga-in?${query}`}>Jag har redan ett konto</Link> : <Link href={`/logga-in?konto=1&${query}`}>Skapa ett konto</Link>}
        </p>
        {!creating && <p style={{ marginTop: 8 }}><Link href="/glomt-losenord">Glömt lösenordet?</Link></p>}
      </div>
    </AppPage>
  );
}
