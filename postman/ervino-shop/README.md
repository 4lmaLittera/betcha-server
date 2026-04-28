# Ervino Postman testai — `shop`

## Greitas paleidimas (tik ką reikia padaryti)

1. Atidaryk terminalą `betcha-server` kataloge.

2. Paleisk serverį:

```powershell
npm install
npm run dev
```

3. Gauk JWT tokeną (PowerShell):

```powershell
$body = @{ email = "<email>"; password = "<password>" } | ConvertTo-Json

$response = Invoke-RestMethod -Method Post `
  -Uri "https://wsbsbtxtlcdgtcitdmpt.supabase.co/auth/v1/token?grant_type=password" `
  -Headers @{ apikey = "sb_publishable_v394j3VO9HAv41jzUOb-jA_mw7NgSWR" } `
  -ContentType "application/json" `
  -Body $body

$response.access_token
```

4. Įklijuok gautą `access_token` į failą:

- `postman/ervino-shop/Betcha-Shop-Ervinas.postman_environment.json`
- laukas: `token`

5. Paleisk testus:

```powershell
npx --yes newman run postman/ervino-shop/Betcha-Shop-Ervinas.postman_collection.json -e postman/ervino-shop/Betcha-Shop-Ervinas.postman_environment.json --working-dir postman/ervino-shop --reporters cli,json --reporter-json-export postman/ervino-shop/newman-report.json
```

## Tikėtinas rezultatas

- `requests: 4`
- `assertions: 11`
- `failed: 0`