#!/usr/bin/env node
// Helper: gauna Supabase JWT ir įrašo jį į Betcha-US19.postman_environment.json
// Naudojimas:
//   node postman/get-jwt.mjs <email> <password>
// arba interaktyviai (klausia):
//   node postman/get-jwt.mjs

import fs from 'node:fs';
import path from 'node:path';
import readline from 'node:readline/promises';
import { stdin, stdout } from 'node:process';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ENV_FILE = path.join(__dirname, '..', '.env');
const POSTMAN_ENV = path.join(__dirname, 'Betcha-US19.postman_environment.json');

function loadEnv(file) {
  const out = {};
  const content = fs.readFileSync(file, 'utf-8');
  for (const line of content.split('\n')) {
    const m = line.match(/^([A-Z_]+)=(.*)$/);
    if (m) out[m[1]] = m[2].trim().replace(/^["']|["']$/g, '');
  }
  return out;
}

async function prompt(rl, q, hidden = false) {
  if (!hidden) return (await rl.question(q)).trim();
  process.stdout.write(q);
  const old = process.stdin.isTTY ? process.stdin.rawListeners('data') : [];
  return new Promise((resolve) => {
    let val = '';
    const onData = (ch) => {
      const s = ch.toString();
      if (s === '\n' || s === '\r' || s === '\u0004') {
        process.stdin.removeListener('data', onData);
        process.stdout.write('\n');
        resolve(val);
      } else if (s === '\u0003') process.exit(1);
      else if (s === '\u007f') val = val.slice(0, -1);
      else val += s;
    };
    process.stdin.on('data', onData);
  });
}

async function main() {
  const env = loadEnv(ENV_FILE);
  const url = env.SUPABASE_URL;
  const apiKey = env.SUPABASE_KEY;
  if (!url || !apiKey) {
    console.error('❌ .env trūksta SUPABASE_URL arba SUPABASE_KEY');
    process.exit(1);
  }

  let [, , email, password] = process.argv;
  if (!email || !password) {
    const rl = readline.createInterface({ input: stdin, output: stdout });
    if (!email) email = await rl.question('Email: ');
    if (!password) password = await rl.question('Password: ');
    rl.close();
  }

  const res = await fetch(`${url}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: {
      apikey: apiKey,
      'Content-Type': 'application/json',
    },
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
  for (const v of pmEnv.values) {
    if (v.key === 'token') v.value = token;
  }
  fs.writeFileSync(POSTMAN_ENV, JSON.stringify(pmEnv, null, 2) + '\n');
  console.log('✅ Įrašyta į', path.relative(process.cwd(), POSTMAN_ENV));
  console.log('\nToken (jei reikia rankiniu būdu):');
  console.log(token);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
