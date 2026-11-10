import { AppPage } from "@/components/site";

export const metadata = { title: "Villkor | Allocate" };

export default function Terms() {
  return (
    <AppPage narrow>
      <div className="page-head"><h1>Villkor</h1></div>
      <div className="prose">
        <p>Allocate förmedlar kontakt mellan beställare och företag. Avtalet om själva arbetet ingås direkt mellan beställaren och företaget.</p>
        <p>Underlag och prisbilder skapas med hjälp av AI och är en utgångspunkt, inte en offert. Kontrollera alltid uppgifterna med det företag du anlitar.</p>
      </div>
    </AppPage>
  );
}
