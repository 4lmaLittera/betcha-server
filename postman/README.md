# Betcha — Postman kolekcijos

Dvi kolekcijos:
- **US#19** (`/api/analyze`) — pradinė kolekcija, naudota PR #31 metu. Lieka kaip atsarga.
- **US#112** (`/api/tasks/:id/evidence`) — naujesnė kolekcija, naudojama 2-o PKP nd 3 užduotyje. Atitinka 1 užduoties Test Plan #185 (TC-1 #187, TC-2 #188).

Naudojama:
- **2-as PKP nd, 1 užduotis** — papildomas reikalavimo testavimas
- **2-as PKP nd, 3 užduotis** — integraciniai testai tarp dviejų sistemos lygių (HTTP klientas ↔ Express middleware ↔ controller ↔ Supabase Auth/Storage/DB ↔ OpenAI)

## Failai

| Failas | Paskirtis |
|--------|-----------|
| `Betcha-US19.postman_collection.json` | US#19 kolekcija (4 request'ai, 13 assertions, tik funkciniai) |
| `Betcha-US19.postman_environment.json` | US#19 aplinkos kintamieji (`baseUrl`, `token`) |
| **`Betcha-US112.postman_collection.json`** | **US#112 kolekcija (5 request'ai, 19 assertions, funkciniai + nefunkciniai)** |
| **`Betcha-US112.postman_environment.json`** | **US#112 aplinkos kintamieji (6 vnt.: 2 JWT, 2 questId, baseUrl, nonExistent)** |
| `fixtures/messy-kitchen.jpg` | JPEG su matoma netvarka *(įdėk savo failą)* |
| `fixtures/clean-kitchen.jpg` | JPEG švarios virtuvės *(įdėk realų foto stabilesniam AI verdiktui)* |
| `fixtures/black.png` | Visiškai juoda 1×1 PNG (US#19 AI_UNRECOGNIZED) |

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

---

# US#112 kolekcija — `Betcha-US112.postman_collection.json`

5 requests, 19 assertion'ų (~14 funkcinių + 5 nefunkcinių). Endpoint: `POST /api/tasks/:taskId/evidence` (US#112 Quest evidence + AI verdict).

## Setup (vienkartinis)

### 1. Pasiruošti server'į
```bash
cd betcha-server
npm install
cp .env.example .env  # užpildyti SUPABASE_*, OPENAI_API_KEY
npm run dev
```

### 2. Sukurti 2 vartotojus + gauti 2 JWT

US#112 kolekcijai reikia **dviejų** vartotojų: `assignee` (kuris yra `assigned_to`) ir `other` (kitas grupės narys, kuris NĖRA assigned_to — naudojamas 403 testui).

```bash
# 1-as JWT (assignee)
npm run postman:jwt -- assignee@test.com PasswordA123
# Skopijuoti JWT į Betcha-US112.postman_environment.json → tokenAssignee

# 2-as JWT (other user)
npm run postman:jwt -- other@test.com PasswordB456
# Skopijuoti JWT į → tokenOther
```

Jei neturi 2-o test user'io — užregistruok per Supabase Auth UI arba per app prisijungimo ekraną.

### 3. Sukurti 2 quest'us

Per app arba `POST /api/tasks` reikia sukurti **2** atskirus quest'us, abu su:
- `status = open`
- `assigned_to = <assignee user id>`
- `initial_image_url = <messy photo URL>` (nuotrauka, kurią AI laikys netvarkinga)

Du atskiri quest'ai, nes:
- **R1** (rejected) palieka quest `open` (galima pakartoti, bet R2 ant to paties quest'o nustatys į `completed`)
- **R2** (approved) perveda quest į `completed` (po to nebegalima testuoti R1)

```bash
# Per app: prisijungti kaip assignee → sukurti 2 task'us su messy nuotrauka
# arba per curl:
curl -X POST http://localhost:3000/api/tasks \
  -H "Authorization: Bearer $TOKEN_ASSIGNEE" \
  -H "Content-Type: application/json" \
  -d '{"title":"Test 1","description":"...","bettingIndex":3,"groupId":"<group>","photoUrl":"<messy>"}'
# pakartoti antrą sykį → 2 questId
```

Įrašyti questId'us į `Betcha-US112.postman_environment.json`:
- `questIdRejected` ← 1-as quest
- `questIdApproved` ← 2-as quest

### 4. Pasiruošti fixtures

`fixtures/` aplanke:
- ✅ `messy-kitchen.jpg` — sintetinė netvarka (R1, R3, R4)
- ✅ `clean-kitchen.jpg` — sintetinė švari virtuvė (R2)

> **Patarimas**: sintetinis `clean-kitchen.jpg` gali nesuteikti stabiliai `verdict=approved` (DI gali abejoti). Jei R2 testas fail'inasi su `verdict=rejected`, **pakeisk** `clean-kitchen.jpg` į realią švarios virtuvės nuotrauką (≥50KB JPEG). Sintetiniai paveikslėliai veikia, bet realios nuotraukos duoda labiau prognozuojamą AI atsaką.

### 5. Vykdyti per Newman

```bash
npm run test:postman:us112
```

Skriptas paleidžia visus 5 requests, vykdo 19 assertion'ų ir įrašo JSON ataskaitą į `postman/newman-report-us112.json`. Tikslas: **0 failures**.

### 6. Vykdyti per Postman GUI

1. `Import` → `Betcha-US112.postman_collection.json`
2. `Import` → `Betcha-US112.postman_environment.json`
3. Aplinkoje įvesti 2 JWT + 2 questId
4. Paleisti **R1 → R2 → R3 → R4 → R5** (eilė nesvarbi, bet R2 keičia state'ą — paleisk paskutinis, jei dirbi su tuo pačiu quest'u)

## Requests apžvalga

| # | Request | Endpoint | Auth | HTTP | Funkciniai | Nefunkciniai |
|---|---|---|---|---|---|---|
| R1 | Atmestas verdiktas (AC-6) | POST evidence | tokenAssignee | 200 | verdict=rejected, status=open, reason | response time <20s, Content-Type |
| R2 | Sėkmingas verdiktas (AC-5) | POST evidence | tokenAssignee | 200 | verdict=approved, status=completed | response time <20s, Content-Type |
| R3 | 403 ne assigned_to (AC-7) | POST evidence | tokenOther | 403 | error string | response time <2s |
| R4 | 401 be auth | POST evidence | — | 401 | — | response time <1s |
| R5 | 400 be photo | POST evidence | tokenAssignee | 400 | error LT (regex) | response time <1s |

## Postman ↔ Azure Test Plans susiejimas (US#112)

| Postman request | Azure TC | AC | Padengimas |
|---|---|---|---|
| R1 | TC-2 #188 | AC-6 | rejected verdict + open state |
| R2 | TC-1 #187 | AC-5 | approved verdict + completed state |
| R3 | TC-2 #188 | AC-7 | 403 ne assigned_to |
| R4 | (papildomas — saugumas) | — | 401 input validacija |
| R5 | (papildomas — input) | — | 400 input validacija |
