import { AppPage } from "@/components/site";

export const metadata = { title: "Integritet | Allocate" };

export default function Privacy() {
  return (
    <AppPage narrow>
      <div className="page-head"><h1>Integritet</h1></div>
      <div className="prose">
        <p>Allocate kopplar ihop dig som ska få något gjort hemma med företag som kan utföra jobbet. Här beskrivs vilka uppgifter som hanteras.</p>
        <h2>Det här sparar vi</h2>
        <p>Namn, e-post och lösenord i krypterad form. Din beskrivning av jobbet, dina svar, bilder, ritningar, adress och telefonnummer.</p>
        <h2>Det här ser företagen</h2>
        <p>Företag som matchas mot jobbet ser underlaget, bilderna, ritningarna och orten. Adress, namn och telefonnummer ser de först när du har godkänt ett besök eller valt deras offert.</p>
        <h2>AI</h2>
        <p>Din beskrivning, dina svar och dina bilder skickas till DeepSeek, ett AI-företag i Kina, för att skapa frågor och underlag. Uppgifterna behandlas på servrar i Kina. Namn, adress och telefonnummer tas bort ur texten innan den skickas, men dina bilder skickas som de är. Kontrollera därför att inga namn eller andra privata uppgifter syns på bilderna.</p>
        <h2>Bilder</h2>
        <p>Bilder skalas ner i din webbläsare före uppladdning. Då försvinner också platsuppgifter som kan finnas i filen.</p>
      </div>
    </AppPage>
  );
}
