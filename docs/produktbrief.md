# Allocate: produktbrief

Marknadsplats där husägare får offerter från bygg-, el- och VVS-företag.
Företagen är de betalande kunderna. Det är gratis för den som beställer.

Appen är byggd i det här repot med Next.js, Postgres och DeepSeek. Ett tidigare försök i Lovable lades ner.

## Flödet

1. Husägaren beskriver jobbet med egna ord och lägger till bilder.
2. AI läser text och bilder och skapar frågor för just det jobbet: mått, byggår,
   rördragning, foto på elcentralen. Vid behov en andra omgång, högst två.
3. AI skriver ett underlag: arbetsmoment per yrkesgrupp, material, oklarheter,
   tillstånd och behörigheter, preliminär prisbild och ROT.
4. Husägaren ändrar och godkänner underlaget. Inget skickas före godkännandet.
5. Matchning: först hårda filter, sedan rankning med AI. Högst tre företag per yrke.
6. Företagen lämnar offert eller bokar hembesök.
7. Husägaren jämför offerterna och väljer.

## Beslut

| Fråga | Beslut | Varför |
| --- | --- | --- |
| Var ligger sajten? | Eget Next.js-projekt | Full kontroll över design och behörigheter |
| Var ligger databasen? | Postgres, till exempel Supabase | Samma upplägg som ClearSight. Inbyggd databas lokalt |
| Vem får se vad? | Regler i serverkoden, testade automatiskt | All åtkomst går genom `src/lib/marketplace.ts` |
| Chatt eller formulär? | Fritext följt av formulär som AI skapar | Ger mått och bilder i strukturerad form, vilket en chatt inte gör |
| Vem matchar? | Regler filtrerar, AI rankar | Fel yrke, område eller behörighet ska aldrig kunna slinka igenom |
| När krävs konto? | Efter första beskrivningen | Ger bilderna en ägare och skyddar AI-kostnaden |
| Hembesök | Egen del av flödet | Större jobb kräver ofta besök innan offert |

## Vad vi gör bättre än Offerta

Offerta har frågor per jobbtyp och bilduppladdning. Upp till sex företag kan svara
och företagen betalar månadsavgift. Kritiken från företagen på Trustpilot gäller
höga kostnader, många konkurrenter per jobb och hembesök som inte leder till något.
Kunderna klagar på för många kontakter och offerter som är svåra att jämföra.

| Problem | Vårt svar |
| --- | --- |
| Många konkurrerar om samma jobb | Högst tre företag per jobb |
| Hembesök utan resultat | Företaget ser beslutsläge, pengar, godkännande och tillträde innan det svarar |
| Kunder som bara vill veta priset | De får en prisbild direkt och går aldrig ut till företag |
| Kunder som slutar svara | Kunden lovar att ge varje företag ja eller nej |
| Otydliga underlag | Obligatoriska frågor per jobbtyp, mått och namngivna foton |
| Telefonjakt för att boka besök | Kunden anger tider, företaget bokar direkt |
| Offerter som inte går att jämföra | Alla svarar på samma poster från underlaget |
| Samtal från många företag | Kontaktuppgifter delas bara med dem kunden väljer |

Listan med obligatoriska frågor i `src/lib/job-requirements.ts` utgår från allmän
branschkunskap och ska stämmas av med riktiga hantverkare.

## Integritet

- Gatuadress och telefon ligger i en separat tabell. Företag kan bara läsa dem
  när husägaren har valt att gå vidare med just det företaget.
- Bilder visas bara via en inloggad kontroll av vem som frågar. Inga publika länkar finns.
- Bilder skalas ner i webbläsaren före uppladdning. Det tar också bort EXIF och GPS.

- AI-leverantören är DeepSeek, som behandlar uppgifter i Kina. Kina saknar beslut om adekvat
  skyddsnivå från EU. Detta behöver bedömas juridiskt innan riktiga kunders uppgifter skickas dit.
  Byte av leverantör görs med en miljövariabel: utan `DEEPSEEK_API_KEY` används Claude.
- Namn, adress och telefon tas bort ur fritexten innan den skickas till AI-tjänsten.

## Formspråk

Ljust och stilrent med stora foton av färdiga rum. Kol `#1D2124`, sten `#EEEFEC`,
ek `#C29563` som accent och mörk ek `#7E5A35` för text i accentfärg.
Typsnitt: Big Shoulders i versaler för rubriker, Albert Sans för text.

Foton kommer tills vidare från Unsplash, se `src/lib/photos.ts`. De ska bytas mot bilder från riktiga jobb.
Lite liv: yrkena glider in som etiketter när kunden skriver, och korten för badrum, kök och el
fyller i rutan. Besökaren kan stänga av all rörelse.

Används inte: eyebrows, kortrutnät, skuggor, scrollanimationer, påhittade siffror eller omdömen.

Tillgänglighet: WCAG 2.1 AA.

## Medvetet utanför första versionen

- Betalning från företag. Prismodell är inte bestämd.
- Automatisk kontroll av F-skatt och behörigheter. Admin godkänner manuellt.
- E-post när ett jobb, besök eller offert kommer in. Notiser syns än så länge bara i appen.
