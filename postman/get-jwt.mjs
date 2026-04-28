#!/usr/bin/env node
// Helper: gauna Supabase JWT ir įrašo jį į Betcha.postman_environment.json
// Naudojimas:
//   node postman/get-jwt.mjs <email> <password>            # rašo į token (default)
//   node postman/get-jwt.mjs <email> <password> --other    # rašo į tokenOther (US#112 R3 testui)
//   node postman/get-jwt.mjs <email> <password> --key=<varName>
// Interaktyviai (klausia):
//   node postman/get-jwt.mjs

import fs from 'node:fs';
import path from 'node:path';
import readline from 'node:readline/promises';
import { stdin, stdout } from 'node:process';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ENV_FILE = path.join(__dirname, '..', '.env');
const POSTMAN_ENV = path.join(__dirname, 'Betcha.postman_environment.json');

function loadEnv(file) {
  const out = {};
  const content = fs.readFileSync(file, 'utf-8');
  for (const line of content.split('\n')) {
    const m = line.match(/^([A-Z_]+)=(.*)$/);
    if (m) out[m[1]] = m[2].trim().replace(/^["']|["']$/g, '');
  }
  return out;
}

function parseArgs(argv) {
  const positional = [];
  let key = 'token';
  for (const a of argv.slice(2)) {
    if (a === '--other') key = 'tokenOther';
    else if (a.startsWith('--key=')) key = a.slice(6);
    else positional.push(a);
  }
  return { email: positional[0], password: positional[1], key };
}

async function main() {
  const env = loadEnv(ENV_FILE);
  const url = env.SUPABASE_URL;
  const apiKey = env.SUPABASE_KEY;
  if (!url || !apiKey) {
    console.error('❌ .env trūksta SUPABASE_URL arba SUPABASE_KEY');
    process.exit(1);
  }

  let { email, password, key } = parseArgs(process.argv);
  if (!email || !password) {
    const rl = readline.createInterface({ input: stdin, output: stdout });
    if (!email) email = await rl.question('Email: ');
    if (!password) password = await rl.question('Password: ');
    rl.close();
  }

  const res = await fetch(`${url}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: { apikey: apiKey, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });

  const data = await res.json();
  if (!res.ok || !data.access_token) {
    console.error('❌ Login nepavyko:', data);
    process.exit(1);
  }

  const token = data.access_token;
  const expSec = data.expires_in;
  console.log('✅ JWT gautas (galios ~' + Math.round(expSec / 60) + ' min)');

  const pmEnv = JSON.parse(fs.readFileSync(POSTMAN_ENV, 'utf-8'));
  let found = false;
  for (const v of pmEnv.values) {
    if (v.key === key) {
      v.value = token;
      found = true;
    }
  }
  if (!found) {
    console.error(`❌ Postman env neturi kintamojo "${key}"`);
    process.exit(1);
  }
  fs.writeFileSync(POSTMAN_ENV, JSON.stringify(pmEnv, null, 2) + '\n');
  console.log(
    `✅ Įrašyta į ${path.relative(process.cwd(), POSTMAN_ENV)} (key=${key})`,
  );
  console.log('\nToken (jei reikia rankiniu būdu):');
  console.log(token);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
