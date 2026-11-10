import Link from "next/link";
import { AppPage } from "@/components/site";
import { requireUser } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { listCustomerProjects } from "@/lib/marketplace";

export const metadata = { title: "Mina jobb | Allocate" };

const STATUS: Record<string, string> = {
  draft: "Grundfakta saknas", questions: "Frågor att svara på", brief_ready: "Underlag att godkänna", published: "Väntar på företag",
  quoting: "Skickat till företag", awarded: "Företag valt", closed: "Avslutat",
};

export default async function MyProjects() {
  const user = await requireUser("/mina-projekt");
  const projects = await listCustomerProjects(await getDb(), user.id);
  return (
    <AppPage>
      <div className="page-head"><h1>Mina jobb</h1></div>
      {projects.length === 0 ? (
        <p>Du har inga jobb ännu. <Link href="/">Beskriv ditt första jobb.</Link></p>
      ) : (
        <ul>
          {projects.map((p) => (
            <li className="list-row" key={p.id}>
              <h2><Link href={`/projekt/${p.id}`}>{p.title}</Link></h2>
              <span className="tag">{STATUS[p.status]}{p.quotes ? `, ${p.quotes} offerter` : ""}</span>
            </li>
          ))}
        </ul>
      )}
      <p style={{ marginTop: 28 }}><Link href="/" className="btn btn-primary">Beskriv ett nytt jobb</Link></p>
    </AppPage>
  );
}
