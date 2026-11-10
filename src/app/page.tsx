import Link from "next/link";
import { LiveHero, PageMotion, PrefillButton } from "@/components/client";
import { SiteFooter, SiteHeader } from "@/components/site";
import { PHOTOS, photoSrcSet, photoUrl, type Photo } from "@/lib/photos";

const JOBS: { photo: Photo; title: string; text: string; prefill: string; action: string }[] = [
  { photo: PHOTOS.bath, title: "Badrum", text: "Tätskikt, kakel, golvbrunn och golvvärme. Ofta bygg, VVS och el i samma jobb.", prefill: "Vi vill renovera badrummet. ", action: "Beskriv ditt badrum" },
  { photo: PHOTOS.kitchen, title: "Kök", text: "Nya skåp, vitvaror och kanske en vägg som ska bort. Vi frågar om det som påverkar priset.", prefill: "Vi vill byta köket. ", action: "Beskriv ditt kök" },
  { photo: PHOTOS.el, title: "El och laddbox", text: "Ny elcentral, fler uttag eller laddbox. Bara registrerade elinstallationsföretag får jobbet.", prefill: "Vi behöver hjälp med elen. ", action: "Beskriv elarbetet" },
];

const CHECKS = [
  "Om kunden vill anlita någon eller bara vill veta priset",
  "Om pengarna är klara och om föreningen har sagt ja",
  "Mått, bilder och det som fortfarande är oklart",
  "Våning, hiss, parkering och plats för container",
  "Tider då du kan boka besöket direkt",
  "Hur många andra som räknar på samma jobb",
];

function Img({ photo, sizes, className }: { photo: Photo; sizes: string; className?: string }) {
  // eslint-disable-next-line @next/next/no-img-element
  return <img className={className} src={photoUrl(photo, 900)} srcSet={photoSrcSet(photo, [600, 900, 1300])} sizes={sizes} alt={photo.alt} loading="lazy" decoding="async" />;
}

export default function Home() {
  return (
    <>
      <LiveHero header={<SiteHeader />} />

      <section className="section wrap" aria-labelledby="jobb">
        <h2 id="jobb" className="caps">Jobb vi hjälper dig med</h2>
        <ul className="job-tiles">
          {JOBS.map((job, i) => (
            <li key={job.title} data-reveal style={{ ["--i" as string]: i }}>
              <div className="tile-photo"><Img photo={job.photo} sizes="(min-width: 900px) 33vw, 100vw" /></div>
              <h3>{job.title}</h3>
              <p>{job.text}</p>
              <PrefillButton text={job.prefill}>{job.action}</PrefillButton>
            </li>
          ))}
        </ul>
      </section>

      <section className="section band" aria-labelledby="underlag">
        <div className="wrap split">
          <div>
            <h2 id="underlag" className="caps">Ett underlag som går att räkna på</h2>
            <p className="lead">Du skriver med egna ord. Vi frågar efter det hantverkaren behöver: mått, byggår, var rören går och bilder på rätt saker.</p>
            <ol className="steps">
              <li data-reveal><h3>Beskriv jobbet</h3><p>Skriv vad som ska göras och lägg till bilder från mobilen.</p></li>
              <li data-reveal style={{ ["--i" as string]: 1 }}><h3>Svara på frågorna</h3><p>Frågorna utgår från ditt jobb. Vet du inte, så säger du det.</p></li>
              <li data-reveal style={{ ["--i" as string]: 2 }}><h3>Godkänn underlaget</h3><p>Du ser varje moment och ändrar det som inte stämmer.</p></li>
              <li data-reveal style={{ ["--i" as string]: 3 }}><h3>Jämför offerterna</h3><p>Alla företag prissätter samma rader. Du väljer.</p></li>
            </ol>
          </div>
          <article className="doc" aria-label="Exempel på underlag" data-reveal>
            <h3 style={{ marginTop: 0 }}>Exempel: badrum, 6,2 m², byggt 1974</h3>
            <ul className="doc-items">
              <li><p className="doc-task">Rivning av klinker och kakel, 6,2 m²</p><p>Golv och väggar rivs ned till stomme.</p><p className="doc-meta"><span className="basis">Från dig</span></p></li>
              <li className="assumption"><p className="doc-task">Asbestprov före rivning</p><p>Huset byggdes under en tid då asbest användes i fix och mattor.</p><p className="doc-meta"><span className="basis">Antagande</span></p></li>
              <li><p className="doc-task">Byte av golvbrunn, 1 st</p><p>Plastbrunn av äldre modell syns på bilden.</p><p className="doc-meta"><span className="basis">Från bild</span></p></li>
              <li className="assumption"><p className="doc-task">Golvvärme med egen matning</p><p>Huvudsäkring 20 A, plats i centralen behöver kontrolleras.</p><p className="doc-meta"><span className="basis">Antagande</span></p></li>
            </ul>
          </article>
        </div>
      </section>

      <section className="section wrap" aria-labelledby="regler">
        <h2 id="regler" className="caps">Så håller vi ordning på det</h2>
        <ul className="rules">
          <li data-reveal><b>3</b><h3>företag per yrke, högst</h3><p>Du slipper drunkna i svar, och företagen vet att offerten är värd att skriva.</p></li>
          <li data-reveal style={{ ["--i" as string]: 1 }}><b>0</b><h3>samtal innan du har valt</h3><p>Företagen ser jobbet och orten. Adress och telefonnummer får bara de du går vidare med.</p></li>
          <li data-reveal style={{ ["--i" as string]: 2 }}><b>1</b><h3>underlag som alla räknar på</h3><p>Samma rader i varje offert, så att du jämför samma sak.</p></li>
        </ul>
      </section>

      <section className="companies dark" aria-labelledby="foretag">
        <div className="companies-photo"><Img photo={PHOTOS.craft} sizes="(min-width: 900px) 50vw, 100vw" /></div>
        <div className="companies-body">
          <h2 id="foretag" className="caps">Driver du bygg-, el- eller VVS-firma?</h2>
          <p className="lead">Du ser allt som avgör om jobbet är värt tiden, innan du sätter dig i bilen.</p>
          <ul className="checks">
            {CHECKS.map((check, i) => <li key={check} data-reveal style={{ ["--i" as string]: i }}>{check}</li>)}
          </ul>
          <Link href="/foretag/ansok" className="btn btn-signal">Ansök som företag</Link>
        </div>
      </section>

      <SiteFooter />
      <div className="wrap motion-row">
        <p className="credits">Foton från Unsplash: {Object.values(PHOTOS).map((p) => p.author).join(", ")}.</p>
        <PageMotion />
      </div>
    </>
  );
}
