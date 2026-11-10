# Allocate

Marknadsplats där husägare beskriver ett jobb och får offerter från högst tre bygg-, el- eller VVS-företag per yrke.
Produktbeslut och jämförelsen med Offerta finns i [docs/produktbrief.md](docs/produktbrief.md).

## Köra lokalt

```bash
npm install
cp .env.example .env.local
npm run dev
```

Sajten startar på http://localhost:3100. Utan `DATABASE_URL` används en inbyggd databas i `.data/`.
Sätt `AI_FAKE=1` för att köra hela flödet utan AI-kostnad, eller `DEEPSEEK_API_KEY` för riktiga svar.
E-postadresser i `ADMIN_EMAILS` blir administratörer och kan godkänna företag på `/admin`.

## Testa

```bash
npm test
```

## Publicera

Sätt `DATABASE_URL`, `DEEPSEEK_API_KEY`, `ADMIN_EMAILS` och `SITE_URL` hos värden, till exempel Vercel.
Tabellerna skapas automatiskt vid första anropet. Använd Supabase transaction pooler som `DATABASE_URL`.

## Bra att veta

- Vem som får se vad avgörs i `src/lib/marketplace.ts`. Företag läser aldrig `project_private` innan kunden har valt dem.
- De obligatoriska frågorna per jobbtyp finns i `src/lib/job-requirements.ts`.
- Bilder ligger i databasen. Det räcker i början. Vid större volymer bör de flyttas till fillagring.
- AI-leverantör väljs i `getAi` i `src/lib/ai.ts`. DeepSeek behandlar uppgifter i Kina, se avsnittet Integritet i produktbriefen.
- En uppladdad fil får vara högst 4 MB på grund av Vercels gräns för anrop.
