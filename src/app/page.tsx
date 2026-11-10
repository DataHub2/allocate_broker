import Link from "next/link";
import { LiveHero, PageMotion } from "@/components/client";
import { SiteFooter, SiteHeader } from "@/components/site";

const JOBS = ["Badrum", "Kök", "Laddbox", "Stambyte", "Takbyte", "Fasad", "Golvvärme", "Altan", "Elcentral", "Värmepump", "Fönster", "Dränering"];

const CHECKS = [
  "Om kunden vill anlita någon eller bara vill veta priset",
  "Om pengarna är klara och om föreningen har sagt ja",
  "Mått, bilder och det som fortfarande är oklart",
  "Våning, hiss, parkering och plats för container",
  "Tider då du kan boka besöket direkt",
  "Hur många andra som räknar på samma jobb",
];

function Scribble() {
  return (
    <svg className="scribble" viewBox="0 0 220 60" aria-hidden="true" focusable="false">
      <path pathLength={1} d="M12 34C38 10 96 4 150 9c38 4 62 14 58 28-5 16-58 20-104 17C62 52 8 48 6 30 5 18 26 9 58 6" />
    </svg>
  );
}

export default function Home() {
  return (
    <>
      <LiveHero header={<SiteHeader />} />

      <div className="tape" aria-hidden="true">
        <div className="tape-track">
          {[0, 1].map((copy) => <span key={copy}>{JOBS.map((job) => <b key={job}>{job}</b>)}</span>)}
        </div>
      </div>

      <section className="section wrap split" aria-labelledby="underlag">
        <div>
          <h2 id="underlag">Ett underlag som går att räkna på</h2>
          <p className="lead">Du skriver med egna ord. Vi frågar efter det hantverkaren behöver: mått, byggår, var rören går och bilder på rätt saker.</p>
          <ol className="steps" data-tape>
            <li data-reveal><h3>Beskriv jobbet</h3><p>Skriv vad som ska göras och lägg till bilder från mobilen.</p></li>
            <li data-reveal><h3>Svara på frågorna</h3><p>Frågorna utgår från ditt jobb. Vet du inte, så säger du det.</p></li>
            <li data-reveal><h3>Godkänn underlaget</h3><p>Du ser varje moment och ändrar det som inte stämmer.</p></li>
            <li data-reveal><h3>Jämför offerterna</h3><p>Alla företag prissätter samma rader. Du väljer.</p></li>
          </ol>
        </div>
        <article className="doc paper" aria-label="Exempel på underlag" data-reveal>
          <h3 style={{ marginTop: 0 }}>Exempel: badrum, 6,2 m², byggt 1974</h3>
          <ul className="doc-items">
            <li><p className="doc-task">Rivning av klinker och kakel, 6,2 m²</p><p>Golv och väggar rivs ned till stomme.</p><p className="doc-meta"><span className="basis">Från dig</span></p></li>
            <li className="assumption">
              <p className="doc-task">Asbestprov före rivning</p><p>Huset byggdes under en tid då asbest användes i fix och mattor.</p><p className="doc-meta"><span className="basis">Antagande</span></p>
              <p className="hand-note">bra att någon tänkte på det</p>
            </li>
            <li>
              <p className="doc-task"><span className="circled">Byte av golvbrunn<Scribble /></span>, 1 st</p><p>Plastbrunn av äldre modell syns på bilden.</p><p className="doc-meta"><span className="basis">Från bild</span></p>
            </li>
            <li className="assumption"><p className="doc-task">Golvvärme med egen matning</p><p>Huvudsäkring 20 A, plats i centralen behöver kontrolleras.</p><p className="doc-meta"><span className="basis">Antagande</span></p></li>
          </ul>
        </article>
      </section>

      <section className="section dark roof" aria-labelledby="regler">
        <div className="wrap">
          <h2 id="regler">Så håller vi ordning på det</h2>
          <ul className="rules">
            <li data-reveal style={{ ["--step" as string]: 0 }}><b>3</b><div><h3>företag per yrke, högst</h3><p>Du slipper drunkna i svar, och företagen vet att offerten är värd att skriva.</p></div></li>
            <li data-reveal style={{ ["--step" as string]: 1 }}><b>0</b><div><h3>samtal innan du har valt</h3><p>Företagen ser jobbet och orten. Adress och telefonnummer får bara de du går vidare med.</p></div></li>
            <li data-reveal style={{ ["--step" as string]: 2 }}><b>1</b><div><h3>underlag som alla räknar på</h3><p>Samma rader i varje offert, så att du jämför samma sak.</p></div></li>
          </ul>
        </div>
      </section>

      <section className="section copper roof-flip" aria-labelledby="foretag">
        <div className="wrap split">
          <div>
            <h2 id="foretag">Driver du bygg-, el- eller VVS-firma?</h2>
            <p className="hand-line">slipp åka hem till folk i onödan</p>
            <Link href="/foretag/ansok" className="btn btn-primary">Ansök som företag</Link>
          </div>
          <div>
            <p className="lead" style={{ marginTop: 0 }}>Du ser allt som avgör om jobbet är värt tiden, innan du sätter dig i bilen.</p>
            <ul className="checks">
              {CHECKS.map((check, i) => <li key={check} data-reveal style={{ ["--i" as string]: i }}>{check}</li>)}
            </ul>
          </div>
        </div>
      </section>

      <SiteFooter />
      <div className="wrap motion-row"><PageMotion /></div>
    </>
  );
}
