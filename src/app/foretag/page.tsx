import Link from "next/link";
import { redirect } from "next/navigation";
import { AppPage } from "@/components/site";
import { requireUser } from "@/lib/auth";
import { formatSek } from "@/lib/brief";
import { getDb } from "@/lib/db";
import { companyInbox, companyOf } from "@/lib/marketplace";

export const metadata = { title: "Företag | Allocate" };

const STATUS: Record<string, string> = {
  invited: "Nytt", viewed: "Inte besvarat", declined: "Du tackade nej", visit_requested: "Väntar på kundens svar om besök",
  visit_confirmed: "Besök bokat", quoted: "Offert skickad", won: "Du fick jobbet", lost: "Gick till annat företag",
};

export default async function CompanyHome() {
  const user = await requireUser("/foretag");
  const db = await getDb();
  const company = await companyOf(db, user.id);
  if (!company) redirect("/foretag/ansok");
  if (company.status !== "approved") {
    return (
      <AppPage narrow>
        <div className="page-head">
          <h1>{company.name}</h1>
          <p>{company.status === "pending" ? "Vi går igenom din ansökan. Du ser jobben här så snart företaget är godkänt." : "Företaget är avstängt. Kontakta oss om du tror att det är fel."}</p>
        </div>
      </AppPage>
    );
  }
  const jobs = await companyInbox(db, company.id);
  return (
    <AppPage>
      <div className="page-head"><h1>Jobb till {company.name}</h1></div>
      {jobs.length === 0 ? <p>Inga jobb ännu. När ett jobb passar era yrken och områden visas det här.</p> : (
        <ul>
          {jobs.map((j) => (
            <li className="list-row" key={j.id}>
              <div>
                <h2><Link href={`/foretag/jobb/${j.id}`}>{j.title}</Link></h2>
                <p>{j.city}, preliminärt {formatSek(j.content.price_estimate.low_sek)} till {formatSek(j.content.price_estimate.high_sek)}</p>
              </div>
              <span className="tag">{STATUS[j.status]}</span>
            </li>
          ))}
        </ul>
      )}
    </AppPage>
  );
}
