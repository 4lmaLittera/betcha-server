# Betcha — Postman kolekcija (US#19)

Naudojama:
- **2-as PKP nd, 1 užduotis** — manualus reikalavimo US#19 testavimas
- **2-as PKP nd, 3 užduotis** — integraciniai testai tarp dviejų sistemos lygių (HTTP klientas ↔ Express middleware ↔ controller ↔ OpenAI ↔ Supabase)

## Failai

| Failas | Paskirtis |
|--------|-----------|
| `Betcha-US19.postman_collection.json` | Test'ų kolekcija (4 request'ai) |
| `Betcha-US19.postman_environment.json` | Aplinkos kintamieji (`baseUrl`, `token`) |
| `fixtures/messy-kitchen.jpg` | TC-2: JPEG su matoma netvarka *(įdėk savo failą)* |
| `fixtures/black.png` | TC-5: visiškai juoda 1×1 PNG *(įdėk savo failą)* |

## Paleidimas

### 1. Pasiruošti server'į

```bash
cd betcha-server
npm install
cp .env.example .env  # užpildyti: SUPABASE_URL, SUPABASE_KEY, SUPABASE_JWT_SECRET, OPENAI_API_KEY
npm run dev
```

Serveris turi būti pasiekiamas adresu, atitinkančiu `{{baseUrl}}` (default: `http://localhost:3000`).

### 2. Gauti Supabase JWT (automatizuota)

Iš `betcha-server` šaknies:

```bash
npm run postman:jwt -- <email> <password>
# arba interaktyviai:
npm run postman:jwt
```

Skriptas perskaito `SUPABASE_URL` + `SUPABASE_KEY` iš `.env`, gauna JWT per Supabase Auth API ir įrašo jį į `Betcha-US19.postman_environment.json` `token` lauką. Po to gali iškart importuoti naują environment failą į Postman GUI arba paleisti per Newman.

### 3. Pasiruošti fixtures

`fixtures/` aplanke jau yra paruošti failai:
- ✅ `messy-kitchen.jpg` — sintetinė 800×600 px „netvarkos" scena (atsitiktinės figūros + triukšmas), generuota su PIL (`black.png` greta — taip pat įrašytas)
- ✅ `black.png` — 1×1 px visiškai juoda PNG (DI nepripažįstamas vaizdas)

Jei nori pakeisti į tikrą nuotrauką (pvz. iš telefono), tiesiog perrašyk failą tuo pačiu vardu. Sintetinis paveikslėlis veikia su OpenAI Vision (DI gali grąžinti `verdict='unclear'` arba `'mess'` priklausomai nuo modelio interpretacijos), bet realios netvarkos foto duos labiau prognozuojamą `verdict='mess'`.

### 4. Importuoti į Postman

1. Postman → `Import` → pasirinkti `Betcha-US19.postman_collection.json`
2. Tas pats su `Betcha-US19.postman_environment.json`
3. Aplinkoje įvesti `token` (Supabase JWT)
4. Kolekcijos request'uose, lauke `photo`, pasirinkti failą iš `fixtures/`

### 5. Vykdyti

- Atidaryti `TC-2: Sekminga JPEG analize` → `Send` → `Tests` skiltyje matomi assertion rezultatai
- Tas pats su `TC-5`, `TC-5b`
- Po TC-2 ir TC-5 — atidaryti Supabase Studio → `ai_logs` lentelę → patikrinti įrašus pagal `lastSuccessUploadId` ir `lastFailedUploadId` collection variables (Postman → Collection → Variables tab)

### 6. Vykdymas per CLI (Newman)

Iš `betcha-server` šaknies:

```bash
npm run test:postman
# pirmą kartą npx parsisiųs newman automatiškai
```

Tai paleidžia visus 4 request'us, vykdo assertion'us ir įrašo JSON ataskaitą į `postman/newman-report.json`. Naudinga 3 užduočiai — gali būti pridėta į CI pipeline (GitHub Actions).

## TC ↔ Azure Test Plans susiejimas

| Postman request | Azure TC | AC | Tipas |
|------------------|----------|-----|-------|
| TC-2: Sekminga JPEG analize | TC-2 (#161) | AC-2 | Manual + Auto |
| TC-5: AI_UNRECOGNIZED | TC-5 (#164) | AC-4 | Manual + Auto |
| TC-5b: Be photo lauko | (papildomas — input validacija) | — | 3 užduočiai |
| TC-6 prep | TC-6 (#165) – placeholder | AC-5 | Manual (DB query) |
