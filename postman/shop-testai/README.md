# Parduotuvės Postman testai” `shop`

## Greitas paleidimas

1. Atidaryk terminalą… `betcha-server` kataloge.

2. Paleisk serverį:

```powershell
npm install
npm run dev
```

3. Gauti JWT tokeną… (PowerShell):

```powershell
$body = @{ email = "<email>"; password = "<password>" } | ConvertTo-Json

$response = Invoke-RestMethod -Method Post `
  -Uri "https://wsbsbtxtlcdgtcitdmpt.supabase.co/auth/v1/token?grant_type=password" `
  -Headers @{ apikey = "sb_publishable_v394j3VO9HAv41jzUOb-jA_mw7NgSWR" } `
  -ContentType "application/json" `
  -Body $body

$response.access_token
```

4. Įklijuoti gautą… `access_token` į failą…:

- `postman/shop-testai/Betcha-Shop.postman_environment.json`
- laukas: `token`

5. Paleisk testus:

```powershell
npx --yes newman run postman/shop-testai/Betcha-Shop.postman_collection.json -e postman/shop-testai/Betcha-Shop.postman_environment.json --working-dir postman/shop-testai --reporters cli,json --reporter-json-export postman/shop-testai/newman-report.json
```

## Tikėtinas rezultatas

- `requests: 4`
- `assertions: 11`
- `failed: 0`

