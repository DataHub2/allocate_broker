import Link from "next/link";
import type { ReactNode } from "react";
import { signOutAction } from "@/app/actions";
import { currentUser } from "@/lib/auth";

export async function SiteHeader() {
  const user = await currentUser();
  return (
    <header className="wrap site-header">
      <Link href="/" className="brand">Allocate</Link>
      <nav className="site-nav" aria-label="Huvudmeny">
        {user ? (
          <>
            <Link href="/mina-projekt">Mina jobb</Link>
            <Link href="/foretag">Företag</Link>
            {user.is_admin && <Link href="/admin">Admin</Link>}
            <form action={signOutAction}><button type="submit">Logga ut</button></form>
          </>
        ) : (
          <>
            <Link href="/foretag/ansok">För företag</Link>
            <Link href="/logga-in">Logga in</Link>
          </>
        )}
      </nav>
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="wrap site-footer">
      <span className="brand">Allocate</span>
      <nav aria-label="Sidfot">
        <Link href="/integritet">Integritet</Link>
        <Link href="/villkor">Villkor</Link>
      </nav>
    </footer>
  );
}

export function Progress({ step, label }: { step: number; label: string }) {
  return (
    <div className="progress-wrap">
      <p className="progress">Steg {step} av 4: {label}</p>
      <div className="progress-tape" style={{ ["--p" as string]: step / 4 }} aria-hidden="true"><span /></div>
    </div>
  );
}

export function AppPage({ children, narrow }: { children: ReactNode; narrow?: boolean }) {
  return (
    <>
      <SiteHeader />
      <main id="innehall" className={`app wrap ${narrow ? "narrow" : ""}`}>{children}</main>
      <SiteFooter />
    </>
  );
}
