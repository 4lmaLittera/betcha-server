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
| **`Betcha-US112.postman_collection.json`** | **US#112 kolekcija (5 request'ai, 19 assertions, funkciniai + nefunkciniai)** |
| **`Betcha.postman_environment.json`** | **Bendras env failas (`baseUrl`, `token`, `tokenOther`, `questIdRejected`, `questIdApproved`, `nonExistentQuestId`) — naudojamas abiejų kolekcijų** |
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

### 2. Vienos komandos automatinis setup (rekomenduoju)

```bash
npm run postman:setup:us112
```

Skriptas atlieka:
1. Signup/login `postman1@gmail.com` ir `postman2@gmail.com` (slaptažodis `12345678`)
2. Sukuria/randa bendrą grupę
3. Įkelia `messy-kitchen.jpg` į Supabase Storage per `/api/analyze`
4. Sukuria 2 quest'us (kuria `user2`, kad `assigned_to` taptų `user1`)
5. Įrašo viską į `Betcha.postman_environment.json`

Po šio žingsnio gali iškart paleisti `npm run test:postman:us112` — visi 19 assertion'ų turi PASS.

> **Alternatyva (manualiai)**: jei nori naudoti savo test users, ir individualų setup'ą:

### 2-alt. Sukurti 2 vartotojus + gauti 2 JWT

US#112 kolekcijai reikia **dviejų** vartotojų: `assignee` (kuris yra `assigned_to`) ir `other` (kitas grupės narys, kuris NĖRA assigned_to — naudojamas R3 403 testui). Abu turi būti **toje pačioje grupėje**.

Bendras `Betcha.postman_environment.json` (vienas failas US#19 ir US#112). `get-jwt.mjs` palaiko `--other` flag'ą antrojo vartotojo JWT įrašymui:

```bash
# 1-as JWT — į token (assignee)
npm run postman:jwt -- assignee@test.com PasswordA123

# 2-as JWT — į tokenOther (kitas grupės narys, R3 403 testui)
npm run postman:jwt -- other@test.com PasswordB456 --other
```

Jei 2-o test user'io neturi — užregistruok per Supabase Auth UI arba per app prisijungimo ekraną. Pridėk jį į **tą pačią grupę**, kurioje yra 1-as.

### 3. Sukurti 2 quest'us su `assigned_to=token user`

`POST /api/tasks` **atsitiktinai** parenka `assigned_to` iš grupės narių, **išskyrus kūrėją** (žr. `taskController.ts:57-64`). Todėl, kad token user'is taptų `assigned_to`:

> **Quest'us turi kurti `tokenOther` (kitas vartotojas)** — tada sistema priskirs token user'iui (jei grupėje tik 2 nariai).

```bash
# Eksportuok 2-o user'io JWT iš env arba paleisk get-jwt
export TOKEN_OTHER="<paste tokenOther JWT>"
export GROUP_ID="<group UUID, kuriame abu nariai>"
export MESSY_URL="https://example.com/messy.jpg"  # arba real Supabase Storage URL

# Sukurk 2 quest'us
curl -s -X POST http://localhost:3000/api/tasks \
  -H "Authorization: Bearer $TOKEN_OTHER" \
  -H "Content-Type: application/json" \
  -d "{\"title\":\"Test rejected\",\"description\":\"R1 testas\",\"bettingIndex\":3,\"groupId\":\"$GROUP_ID\",\"photoUrl\":\"$MESSY_URL\"}"

curl -s -X POST http://localhost:3000/api/tasks \
  -H "Authorization: Bearer $TOKEN_OTHER" \
  -H "Content-Type: application/json" \
  -d "{\"title\":\"Test approved\",\"description\":\"R2 testas\",\"bettingIndex\":3,\"groupId\":\"$GROUP_ID\",\"photoUrl\":\"$MESSY_URL\"}"
```

Atsakyme bus `{ id, assigned_to, initial_image_url }`. Patikrink, kad `assigned_to` atitinka **token user'io** ID. Jei ne — pakartok `POST` (atsitiktinis pasirinkimas; jei grupė turi tik 2 narius, beveik garantuotai bus token user'is).

Įrašyk abu `id` į `Betcha.postman_environment.json`:
- `questIdRejected` ← 1-as quest
- `questIdApproved` ← 2-as quest

### 4. Pasiruošti fixtures

`fixtures/` aplanke:
- ✅ `messy-kitchen.jpg` — netvarka (R1, R3, R4)
- ✅ `clean-kitchen.jpg` — švari virtuvė (R2)

> **Patarimas**: jei `clean-kitchen.jpg` neduos stabiliai `verdict=approved`, pakeisk realiu foto. Tas pats su `messy-kitchen.jpg` jei `rejected` neveikia.

### 5. Vykdyti per Newman

```bash
npm run test:postman:us112
```

19 assertion'ų. Ataskaita: `postman/newman-report-us112.json`. Tikslas: **0 failures**.

### 6. Vykdyti per Postman GUI

1. `Import` → `Betcha-US112.postman_collection.json`
2. `Import` → `Betcha.postman_environment.json` (bendras failas)
3. Aplinkoje turi būti įrašyti `token`, `tokenOther`, `questIdRejected`, `questIdApproved`
4. Eilė nesvarbi, bet R2 perveda quest į `completed` — paleisk po R1, jei vienam quest'ui

## Requests apžvalga

| # | Request | Endpoint | Auth | HTTP | Funkciniai | Nefunkciniai |
|---|---|---|---|---|---|---|
| R1 | Atmestas verdiktas (AC-6) | POST evidence | token | 200 | verdict=rejected, status=open, reason | response time <20s, Content-Type |
| R2 | Sėkmingas verdiktas (AC-5) | POST evidence | token | 200 | verdict=approved, status=completed | response time <20s, Content-Type |
| R3 | 403 ne assigned_to (AC-7) | POST evidence | tokenOther | 403 | error string | response time <2s |
| R4 | 401 be auth | POST evidence | — | 401 | — | response time <1s |
| R5 | 400 be photo | POST evidence | token | 400 | error LT (regex) | response time <1s |

## Postman ↔ Azure Test Plans susiejimas (US#112)

| Postman request | Azure TC | AC | Padengimas |
|---|---|---|---|
| R1 | TC-2 #188 | AC-6 | rejected verdict + open state |
| R2 | TC-1 #187 | AC-5 | approved verdict + completed state |
| R3 | TC-2 #188 | AC-7 | 403 ne assigned_to |
| R4 | (papildomas — saugumas) | — | 401 input validacija |
| R5 | (papildomas — input) | — | 400 input validacija |
