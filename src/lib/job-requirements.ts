/**
 * What a tradesperson needs to know to price a job or decide it is worth a visit.
 * The AI may add questions and prefill answers, but cannot remove anything from these lists.
 */
export const TRADES = ["bygg", "el", "vvs", "maleri", "golv", "tak", "mark"] as const;
export type Trade = (typeof TRADES)[number];

export const TRADE_LABEL: Record<Trade, string> = {
  bygg: "Bygg",
  el: "El",
  vvs: "VVS",
  maleri: "Måleri",
  golv: "Golv",
  tak: "Tak",
  mark: "Mark",
};

export const JOB_TYPES = ["badrum", "kok", "el", "laddbox", "vvs", "tak", "fasad_fonster", "golv", "maleri", "mark_altan", "allmant"] as const;
export type JobType = (typeof JOB_TYPES)[number];

export type InputType = "number" | "text" | "longtext" | "single" | "multi" | "photo";

export interface Requirement {
  key: string;
  topic: string;
  trade: Trade | null;
  label: string;
  reason: string;
  inputType: InputType;
  unit?: string;
  options?: string[];
  measureHelp?: string;
}

const YES_NO = ["Ja", "Nej"];
const MEASURE = "Mät från vägg till vägg vid golvet. Skriv svaret i meter, till exempel 2,4.";
const HEIGHT = "Mät från golv till tak i mitten av rummet. Skriv svaret i meter.";
const measure = (key: string, topic: string, trade: Trade, label: string, reason: string, help = MEASURE): Requirement => ({
  key, topic, trade, label, reason, inputType: "number", unit: "m", measureHelp: help,
});
const pick = (key: string, topic: string, trade: Trade | null, label: string, reason: string, options: string[]): Requirement => ({
  key, topic, trade, label, reason, inputType: "single", options,
});
const say = (key: string, topic: string, trade: Trade | null, label: string, reason: string): Requirement => ({
  key, topic, trade, label, reason, inputType: "text",
});
const shot = (key: string, trade: Trade | null, label: string, reason: string): Requirement => ({
  key, topic: "Bilder", trade, label, reason, inputType: "photo",
});
const count = (key: string, topic: string, trade: Trade, label: string, reason: string, unit = "st"): Requirement => ({
  key, topic, trade, label, reason, inputType: "number", unit,
});

export const REQUIREMENTS: Record<JobType, Requirement[]> = {
  badrum: [
    measure("badrum.langd", "Mått", "bygg", "Rummets längd", "Styr mängden kakel, tätskikt och arbetstid."),
    measure("badrum.bredd", "Mått", "bygg", "Rummets bredd", "Styr mängden kakel, tätskikt och arbetstid."),
    measure("badrum.hojd", "Mått", "bygg", "Takhöjd", "Väggytan räknas fram med takhöjden.", HEIGHT),
    measure("badrum.dorr", "Mått", "bygg", "Dörrens bredd", "Avgör om badkar och duschvägg går att få in.", "Mät själva dörröppningen. Skriv svaret i meter."),
    pick("badrum.fonster", "Mått", "bygg", "Finns det fönster i rummet?", "Fönster i våtzon kräver extra tätning.", YES_NO),
    say("badrum.golv_nu", "Så ser det ut i dag", "bygg", "Vad finns på golv och väggar i dag?", "Rivning av kakel tar längre tid än rivning av matta."),
    pick("badrum.bjalklag", "Så ser det ut i dag", "bygg", "Vad är golvet byggt av?", "Avgör hur fall mot golvbrunn kan göras.", ["Betong", "Trä"]),
    say("badrum.alder", "Så ser det ut i dag", "bygg", "När renoverades rummet senast?", "Gamla tätskikt kan betyda fuktskador under ytan."),
    pick("badrum.intyg", "Så ser det ut i dag", "bygg", "Finns våtrumsintyg från förra renoveringen?", "Visar om tidigare arbete följde branschreglerna.", YES_NO),
    pick("badrum.fukt", "Så ser det ut i dag", "bygg", "Syns fuktskador eller luktar det unket?", "Fukt kan ändra hela omfattningen av jobbet.", YES_NO),
    pick("badrum.ventilation", "Så ser det ut i dag", "vvs", "Vilken ventilation finns?", "Rummet måste kunna ventileras enligt byggreglerna.", ["Självdrag", "Frånluftsfläkt", "FTX"]),
    say("badrum.brunn", "Rör och avlopp", "vvs", "Var sitter golvbrunnen, och vad är det för sort?", "Gamla brunnar behöver ofta bytas för att tätskiktet ska bli godkänt."),
    pick("badrum.flytt", "Rör och avlopp", "vvs", "Ska golvbrunn, toalett eller dusch flyttas?", "Flytt av avlopp är ofta den största kostnaden.", YES_NO),
    pick("badrum.ytskikt", "Så vill du ha det", "bygg", "Vilket ytskikt vill du ha?", "Klinker och våtrumsmatta har olika pris och arbetstid.", ["Klinker och kakel", "Våtrumsmatta", "Microcement"]),
    say("badrum.format", "Så vill du ha det", "bygg", "Vilket format på plattorna vill du ha?", "Stora och små plattor tar olika lång tid att sätta."),
    pick("badrum.inkop", "Så vill du ha det", "bygg", "Vem köper kakel och inredning?", "Påverkar om materialet ska ingå i offerten.", ["Jag köper själv", "Företaget köper", "Vill diskutera"]),
    pick("badrum.golvvarme", "El", "el", "Vill du ha golvvärme?", "Kräver elinstallatör och en egen matning.", YES_NO),
    shot("badrum.bild_dorr", "bygg", "Hela rummet sett från dörren", "Visar planlösning och skick."),
    shot("badrum.bild_horn", "bygg", "Hela rummet sett från motsatt hörn", "Visar den vägg som inte syns från dörren."),
    shot("badrum.bild_brunn", "vvs", "Golvbrunnen", "Visar typ och skick."),
    shot("badrum.bild_vent", "vvs", "Ventilationsdonet", "Visar vilken ventilation som finns."),
    shot("badrum.bild_skada", "bygg", "Skador eller fuktfläckar", "Hoppa över om det inte finns några."),
  ],
  kok: [
    say("kok.vaggar", "Mått", "bygg", "Hur långa är väggarna där skåpen ska stå?", "Styr antal skåp och arbetstid."),
    measure("kok.hojd", "Mått", "bygg", "Takhöjd", "Avgör om skåpen går upp till taket.", HEIGHT),
    pick("kok.planlosning", "Omfattning", "bygg", "Ska planlösningen ändras?", "Då behöver rör, el och ventilation dras om.", YES_NO),
    pick("kok.vagg", "Omfattning", "bygg", "Ska någon vägg tas bort?", "En bärande vägg kräver konstruktör och kanske bygganmälan.", ["Nej", "Ja, inte bärande", "Ja, bärande", "Ja, vet inte om den är bärande"]),
    say("kok.leverantor", "Omfattning", "bygg", "Vilket kök ska monteras, och är det beställt?", "Montering skiljer sig mellan märken och leveranstid styr startdatum."),
    pick("kok.maskiner", "Omfattning", "bygg", "Vem köper vitvaror?", "Påverkar om de ska ingå i offerten.", ["Jag köper själv", "Företaget köper", "Vill diskutera"]),
    pick("kok.golv", "Omfattning", "golv", "Ska golvet bytas?", "Golv läggs före eller efter skåpen beroende på typ.", YES_NO),
    pick("kok.flytt_vvs", "Rör och el", "vvs", "Ska diskho eller diskmaskin flyttas?", "Flytt av vatten och avlopp påverkar priset mycket.", YES_NO),
    pick("kok.flytt_flakt", "Rör och el", "vvs", "Ska köksfläkten flyttas?", "Kanalen kan behöva dras om genom tak eller vägg.", YES_NO),
    pick("kok.spis", "Rör och el", "el", "Hur ansluts spisen i dag?", "Induktion kan kräva ny matning.", ["Spisuttag", "Fast ansluten", "Gas"]),
    shot("kok.bild_vagg1", "bygg", "Köket från ena hörnet", "Visar planlösning och skick."),
    shot("kok.bild_vagg2", "bygg", "Köket från motsatta hörnet", "Visar resten av rummet."),
    shot("kok.bild_diskho", "vvs", "Under diskhon", "Visar rör och avstängning."),
    shot("kok.bild_el", "el", "Elcentralen", "Visar om centralen klarar nya maskiner. Öppna aldrig mer än luckan."),
  ],
  el: [
    pick("el.huvudsakring", "Elcentralen", "el", "Hur stor är huvudsäkringen?", "Styr hur mycket som kan anslutas.", ["16 A", "20 A", "25 A", "35 A eller mer"]),
    pick("el.central", "Elcentralen", "el", "Vilken sorts säkringar finns?", "Propplåda behöver ofta bytas.", ["Automatsäkringar", "Proppar"]),
    pick("el.jordfel", "Elcentralen", "el", "Finns jordfelsbrytare?", "Krävs i de flesta nya installationer.", YES_NO),
    pick("el.jordat", "Installationen", "el", "Är uttagen jordade i hela bostaden?", "Ojordad el kan behöva dras om.", YES_NO),
    say("el.alder", "Installationen", "el", "Hur gammal är elinstallationen?", "Äldre ledningar kan behöva bytas."),
    count("el.punkter", "Omfattning", "el", "Hur många nya uttag eller lampor behövs?", "Grunden för priset på elarbetet."),
    say("el.vag", "Omfattning", "el", "Var kan kablarna dras?", "Infällt tar längre tid än utanpåliggande."),
    shot("el.bild_central", "el", "Elcentralen med stängd lucka", "Visar märke och storlek. Öppna aldrig mer än luckan."),
    shot("el.bild_matar", "el", "Mätarskåpet", "Visar inkommande matning."),
    shot("el.bild_plats", "el", "Platsen där det nya ska sitta", "Visar väggmaterial och kabelväg."),
  ],
  laddbox: [
    pick("laddbox.huvudsakring", "Elcentralen", "el", "Hur stor är huvudsäkringen?", "Avgör om laddning ryms utan lastbalansering.", ["16 A", "20 A", "25 A", "35 A eller mer"]),
    { ...measure("laddbox.avstand", "Elcentralen", "el", "Avstånd från elcentralen till laddplatsen", "Kabeln är ofta största kostnaden.", "Följ väggarna, inte fågelvägen. Skriv svaret i meter."), },
    pick("laddbox.fas", "Elcentralen", "el", "Har bilen en- eller trefasladdning?", "Styr kabel och laddbox.", ["Enfas", "Trefas"]),
    pick("laddbox.gravning", "Kabelväg", "el", "Måste det grävas för kabeln?", "Grävning kostar extra.", YES_NO),
    shot("laddbox.bild_central", "el", "Elcentralen med stängd lucka", "Visar om det finns plats. Öppna aldrig mer än luckan."),
    shot("laddbox.bild_plats", "el", "Laddplatsen", "Visar väggen och vägen dit."),
  ],
  vvs: [
    pick("vvs.ror", "Rören", "vvs", "Vad är rören gjorda av?", "Äldre galvade rör behöver ofta bytas.", ["Koppar", "Plast (PEX)", "Galvat stål"]),
    say("vvs.avstangning", "Rören", "vvs", "Var sitter huvudkranen för vattnet?", "Vattnet måste kunna stängas av."),
    count("vvs.punkter", "Omfattning", "vvs", "Hur många blandare, toaletter eller anslutningar berörs?", "Grunden för priset."),
    pick("vvs.varme", "Värme", "vvs", "Hur värms huset?", "Styr vilka delar som påverkas.", ["Fjärrvärme", "Bergvärme", "Luft-vatten", "Direktel", "Olja eller ved"]),
    say("vvs.beredare", "Värme", "vvs", "Hur gammal är varmvattenberedaren?", "En gammal beredare byts ofta samtidigt."),
    pick("vvs.avlopp", "Avlopp", "vvs", "Vilket avlopp finns?", "Enskilt avlopp har andra regler.", ["Kommunalt", "Enskilt"]),
    pick("vvs.stam", "Avlopp", "vvs", "Ska stammar bytas?", "Stambyte är ett större jobb.", YES_NO),
    shot("vvs.bild_kran", "vvs", "Huvudkranen", "Visar typ och skick."),
    shot("vvs.bild_pump", "vvs", "Värmesystemets märkskylt", "Visar modell och ålder."),
    shot("vvs.bild_detalj", "vvs", "Det som ska bytas", "Visar anslutningarna."),
  ],
  tak: [
    say("tak.material", "Taket", "tak", "Vad är taket täckt med i dag?", "Rivning och nytt material prissätts olika."),
    count("tak.yta", "Taket", "tak", "Ungefär hur stor är takytan?", "Grunden för priset.", "m²"),
    pick("tak.lutning", "Taket", "tak", "Hur brant är taket?", "Branta tak kräver mer skydd.", ["Flackt", "Normalt", "Brant"]),
    count("tak.vaningar", "Huset", "tak", "Hur många våningar har huset?", "Styr behovet av byggnadsställning."),
    say("tak.alder", "Taket", "tak", "När lades taket?", "Visar om underlaget också behöver bytas."),
    pick("tak.lackage", "Taket", "tak", "Läcker det i dag?", "Kan betyda skador på underlaget.", YES_NO),
    pick("tak.stallning", "Huset", "tak", "Finns plats för byggnadsställning runt huset?", "Annars krävs lift eller annan lösning.", YES_NO),
    pick("tak.skorsten", "Taket", "tak", "Finns skorsten eller takfönster?", "Kräver extra plåtarbete.", YES_NO),
    shot("tak.bild_sida1", "tak", "Taket från ena långsidan", "Visar skick och material."),
    shot("tak.bild_sida2", "tak", "Taket från andra långsidan", "Visar resten av taket."),
    shot("tak.bild_vind", "tak", "Vinden, om du kommer åt den", "Visar råspont och eventuella fuktfläckar."),
  ],
  fasad_fonster: [
    say("fasad.material", "Fasaden", "bygg", "Vad är fasaden gjord av?", "Trä, puts och tegel är olika jobb."),
    count("fasad.yta", "Fasaden", "bygg", "Ungefär hur stor är fasadytan?", "Grunden för priset.", "m²"),
    count("fasad.vaningar", "Fasaden", "bygg", "Hur många våningar har huset?", "Styr behovet av byggnadsställning."),
    count("fasad.antal_fonster", "Fönster", "bygg", "Hur många fönster berörs?", "Grunden för priset."),
    say("fasad.fonstermatt", "Fönster", "bygg", "Vilka mått har fönstren?", "Fönster tillverkas ofta på mått. Ange bredd och höjd för varje storlek."),
    pick("fasad.oppning", "Fönster", "bygg", "Hur ska fönstren öppnas?", "Påverkar produktval.", ["Inåt", "Utåt", "Vet inte än"]),
    shot("fasad.bild_fasad", "bygg", "Varje sida av huset", "Visar skick och höjd."),
    shot("fasad.bild_fonster", "bygg", "Ett fönster på nära håll", "Visar karm och skick."),
  ],
  golv: [
    count("golv.yta", "Mått", "golv", "Hur stor yta ska få nytt golv?", "Grunden för priset.", "m²"),
    say("golv.nu", "Så ser det ut i dag", "golv", "Vilket golv finns i dag?", "Rivning och underlag styr arbetstiden."),
    say("golv.underlag", "Så ser det ut i dag", "golv", "Vad ligger under golvet?", "Betong och trä kräver olika förarbete."),
    pick("golv.trappa", "Omfattning", "golv", "Ingår trappa?", "Trappor prissätts för sig.", YES_NO),
    pick("golv.mobler", "Omfattning", "golv", "Ska företaget flytta möbler?", "Tar extra tid.", YES_NO),
    shot("golv.bild_rum", "golv", "Varje rum", "Visar yta och skick."),
    shot("golv.bild_overgang", "golv", "Övergångar mellan rum", "Visar nivåskillnader."),
  ],
  maleri: [
    count("maleri.rum", "Omfattning", "maleri", "Hur många rum ska målas?", "Grunden för priset."),
    count("maleri.yta", "Omfattning", "maleri", "Ungefär hur stor är golvytan i rummen?", "Väggytan kan uppskattas utifrån den.", "m²"),
    pick("maleri.vad", "Omfattning", "maleri", "Vad ska målas?", "Tak tar längre tid än väggar.", ["Väggar", "Tak", "Väggar och tak"]),
    pick("maleri.tapet", "Så ser det ut i dag", "maleri", "Ska tapet tas bort?", "Tapetborttagning tar lång tid.", YES_NO),
    say("maleri.skick", "Så ser det ut i dag", "maleri", "I vilket skick är ytorna?", "Sprickor och hål måste spacklas."),
    shot("maleri.bild_rum", "maleri", "Varje rum", "Visar yta och skick."),
    shot("maleri.bild_skada", "maleri", "Skador och sprickor", "Visar förarbetet."),
  ],
  mark_altan: [
    count("mark.yta", "Mått", "mark", "Hur stor yta gäller det?", "Grunden för priset.", "m²"),
    pick("mark.lutning", "Tomten", "mark", "Lutar marken?", "Lutning kräver mer schaktning.", ["Plan", "Lite", "Mycket"]),
    say("mark.tillgang", "Tomten", "mark", "Hur bred är vägen in för maskiner?", "Avgör vilka maskiner som kan användas."),
    pick("mark.ledningar", "Tomten", "mark", "Vet du var kablar och rör går i marken?", "Måste vara känt innan någon gräver.", YES_NO),
    say("mark.markslag", "Tomten", "mark", "Vad är det för mark?", "Berg och lera kräver olika arbete."),
    say("mark.material", "Så vill du ha det", "mark", "Vilket material vill du ha?", "Trall, plattor och asfalt har olika pris."),
    shot("mark.bild_yta", "mark", "Ytan från två håll", "Visar storlek och lutning."),
    shot("mark.bild_vag", "mark", "Vägen in till ytan", "Visar om maskiner kommer fram."),
  ],
  allmant: [
    { key: "allmant.omfattning", topic: "Omfattning", trade: null, label: "Beskriv omfattningen med mått om du kan", reason: "Gör att företaget kan bedöma hur stort jobbet är.", inputType: "longtext" },
    shot("allmant.bild", null, "Det som ska göras", "Visar skick och omfattning."),
  ],
};

export function requirementsFor(jobTypes: JobType[]): Requirement[] {
  const seen = new Set<string>();
  const out: Requirement[] = [];
  for (const type of jobTypes.length ? jobTypes : (["allmant"] as JobType[])) {
    for (const requirement of REQUIREMENTS[type]) {
      if (seen.has(requirement.key)) continue;
      seen.add(requirement.key);
      out.push(requirement);
    }
  }
  return out;
}
