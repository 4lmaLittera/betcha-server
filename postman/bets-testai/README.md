# Betcha — Bets Postman testai (Ainaras)

Integraciniai testai POST/GET `/api/bets` endpoint'ams. Naudojama **2-as PKP nd, 3 užduotis**.

## Kolekcijos apžvalga

Endpoint'ai: `POST /api/bets`, `GET /api/bets/quest/:questId`.

Komponentų sąsajos: **HTTP klientas → Express middleware (auth + rate limiter) → betsController → Supabase RPC `place_bet` → DB**.

| # | Request | Tipas | HTTP | Assertions |
|---|---|---|---|---|
| R1 | Sėkmingas statymas | Funkcinis | 200 | 4 |
| R2 | Nepakanka taškų | Funkcinis (validation) | 400 | 2 |
| R3 | Be autentifikacijos | Saugumas | 401 | 2 |
| R4 | Neteisinga `direction` | Input validacija | 400 | 2 |
| R5 | Quest'o lažybų sąrašas | Funkcinis | 200 | 5 |

**Iš viso:** 5 request'ai, 15 assertions.

## Paleidimas

### 1. Pasiruošti server'į

```bash
cd betcha-server
npm install
npm run dev
```

Server turi veikti `http://localhost:3000`.

### 2. Auto setup (vienos komandos)

```bash
node postman/bets-testai/setup-bets.mjs
```

Skriptas:
1. Login/signup `postman3@gmail.com` (bettor) + `postman4@gmail.com` (quest creator)
2. Sukuria/randa bendrą grupę
3. Įkelia testinę nuotrauką į Supabase Storage
4. Kuria quest'ą (kol `assigned_to = postman3`)
5. **Atnaujina postman3 balansą iki 1000** per Supabase REST PATCH (RLS leidžia atnaujinti savo profilį)
6. Įrašo `token`, `tokenOther`, `questId` į `Betcha-Bets.postman_environment.json`

### 3. Vykdyti per Newman (CLI)

```bash
npx newman run postman/bets-testai/Betcha-Bets.postman_collection.json \
  -e postman/bets-testai/Betcha-Bets.postman_environment.json \
  --reporters cli,json \
  --reporter-json-export postman/bets-testai/newman-report.json
```

**Tikslas:** 0 failures, 15/15 assertions PASS.

### 4. Vykdyti per Postman GUI

1. Postman → `Import` → `Betcha-Bets.postman_collection.json`
2. `Import` → `Betcha-Bets.postman_environment.json`
3. Pasirinkti environment dropdown'e
4. Paleisti request'us iš eilės (R1 → R5) — R5 patikrina, kad R1 statymas pateko į DB

> **Svarbu**: Tarp R1 ir R5 žiūrėk, kad rate limiter'is (`betLimiter`) neuždraustų — 3 statymai per 10s. Jei eini greitai, R1+R2+R4 jau yra 3 — palauk 10s prieš R5 (R5 yra GET, neribojamas).

## Susiję reikalavimai

- **REQ #8 (statymai)** — pagrindinis reikalavimas, dengia `placeBet` ir `getQuestBets` controller'ius.
- **Nefunkciniai**: autentifikacijos (R3), rate limiting (kontekstui), input validacija (R2, R4), atsako struktūra (R5).

## Failai

| Failas | Paskirtis |
|---|---|
| `Betcha-Bets.postman_collection.json` | Kolekcija (5 requests, 15 assertions) |
| `Betcha-Bets.postman_environment.json` | Aplinkos kintamieji |
| `setup-bets.mjs` | Auto-setup skriptas |
| `newman-report.json` | Newman ataskaita (po vykdymo) |
