#!/usr/bin/env node
// Automatinis setup'as Bets Postman testams (Ainaras).
//
// Atlieka:
// 1) Login/signup postman3 (bettor) ir postman4 (quest creator)
// 2) Sukuria/randa bendra grupe abiem
// 3) postman4 sukuria quest'a (assigned_to atsitiktinai - laukiame, kad bus postman3)
// 4) postman3 atnaujina savo balansa iki 1000 (per Supabase REST PATCH)
// 5) Iraso tokens + questId i Betcha-Bets.postman_environment.json
//
// Naudojimas:
//   node postman/bets-testai/setup-bets.mjs

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ENV_FILE = path.join(__dirname, '..', '..', '.env');
const POSTMAN_ENV = path.join(__dirname, 'Betcha-Bets.postman_environment.json');
const API_BASE = process.env.API_BASE || 'http://localhost:3000';
const INITIAL_BALANCE = 1000;

const USERS = {
  bettor: { email: 'postman3@gmail.com', password: 'postman123' },
  creator: { email: 'postman4@gmail.com', password: 'postman123' },
};

function loadDotenv(file) {
  const out = {};
  const content = fs.readFileSync(file, 'utf-8');
  for (const line of content.split('\n')) {
    const m = line.match(/^([A-Z_]+)=(.*)$/);
    if (m) out[m[1]] = m[2].trim().replace(/^["']|["']$/g, '');
  }
  return out;
}

const env = loadDotenv(ENV_FILE);
const SUPABASE_URL = env.SUPABASE_URL;
const SUPABASE_KEY = env.SUPABASE_KEY;
if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Truksta SUPABASE_URL/SUPABASE_KEY .env faile');
  process.exit(1);
}

async function supabaseAuth(grant, body) {
  const res = await fetch(`${SUPABASE_URL}/auth/v1/${grant}`, {
    method: 'POST',
    headers: { apikey: SUPABASE_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return { ok: res.ok, status: res.status, data: await res.json() };
}

async function loginOrSignup(email, password) {
  const login = await supabaseAuth('token?grant_type=password', { email, password });
  if (login.ok && login.data.access_token) {
    return { token: login.data.access_token, userId: login.data.user.id };
  }
  console.log(`  signup -> ${email}`);
  const signup = await supabaseAuth('signup', { email, password });
  if (!signup.ok) {
    throw new Error(`Signup nepavyko ${email}: ${JSON.stringify(signup.data)}`);
  }
  if (signup.data.access_token) {
    return { token: signup.data.access_token, userId: signup.data.user.id };
  }
  const retry = await supabaseAuth('token?grant_type=password', { email, password });
  if (!retry.ok || !retry.data.access_token) {
    throw new Error(`Login po signup nepavyko ${email}: ${JSON.stringify(retry.data)}`);
  }
  return { token: retry.data.access_token, userId: retry.data.user.id };
}

async function api(method, urlPath, token, body) {
  const headers = { Authorization: `Bearer ${token}` };
  if (body) headers['Content-Type'] = 'application/json';
  const res = await fetch(`${API_BASE}${urlPath}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let data;
  try { data = text ? JSON.parse(text) : null; } catch { data = text; }
  return { ok: res.ok, status: res.status, data };
}

async function getOrCreateSharedGroup(u1, u2) {
  const u1Groups = await api('GET', '/api/groups', u1.token);
  if (!u1Groups.ok) throw new Error(`GET /api/groups u1: ${JSON.stringify(u1Groups.data)}`);
  const u2Groups = await api('GET', '/api/groups', u2.token);
  if (!u2Groups.ok) throw new Error(`GET /api/groups u2: ${JSON.stringify(u2Groups.data)}`);

  const u1Set = new Set((u1Groups.data || []).map((g) => g.id));
  const shared = (u2Groups.data || []).find((g) => u1Set.has(g.id));
  if (shared) {
    console.log(`  bendra grupe rasta: ${shared.id} (${shared.name})`);
    return shared.id;
  }

  const create = await api('POST', '/api/groups', u1.token, { name: 'Bets Test Group' });
  if (!create.ok) throw new Error(`Sukurti grupe nepavyko: ${JSON.stringify(create.data)}`);
  console.log(`  grupe sukurta: ${create.data.id} (invite=${create.data.invite_code})`);

  const join = await api('POST', '/api/groups/join', u2.token, { inviteCode: create.data.invite_code });
  if (!join.ok && join.status !== 409) throw new Error(`Join nepavyko: ${JSON.stringify(join.data)}`);
  console.log(`  u2 prisijunge`);
  return create.data.id;
}

async function uploadInitialPhoto(token) {
  const filePath = path.join(__dirname, '..', 'fixtures', 'messy-kitchen.jpg');
  const buffer = fs.readFileSync(filePath);
  const boundary = `----b${Date.now()}`;
  const body = Buffer.concat([
    Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="photo"; filename="messy-kitchen.jpg"\r\nContent-Type: image/jpeg\r\n\r\n`),
    buffer,
    Buffer.from(`\r\n--${boundary}--\r\n`),
  ]);
  const res = await fetch(`${API_BASE}/api/analyze`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': `multipart/form-data; boundary=${boundary}` },
    body,
  });
  const data = await res.json();
  if (!res.ok || !data.photoUrl) throw new Error(`Photo upload: ${JSON.stringify(data)}`);
  return data.photoUrl;
}

async function setBalance(userId, token, balance) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/profiles?id=eq.${userId}`, {
    method: 'PATCH',
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      Prefer: 'return=representation',
    },
    body: JSON.stringify({ balance }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(`Balanso atnaujinimas nepavyko: ${JSON.stringify(data)}`);
  return data;
}

function writeEnv(updates) {
  const e = JSON.parse(fs.readFileSync(POSTMAN_ENV, 'utf-8'));
  for (const v of e.values) if (updates[v.key] !== undefined) v.value = String(updates[v.key]);
  fs.writeFileSync(POSTMAN_ENV, JSON.stringify(e, null, 2) + '\n');
}

async function main() {
  console.log('1) Login/signup postman3 (bettor) + postman4 (creator)');
  const bettor = await loginOrSignup(USERS.bettor.email, USERS.bettor.password);
  console.log(`   bettor=${USERS.bettor.email} id=${bettor.userId}`);
  const creator = await loginOrSignup(USERS.creator.email, USERS.creator.password);
  console.log(`   creator=${USERS.creator.email} id=${creator.userId}`);

  console.log('2) Bendra grupe');
  const groupId = await getOrCreateSharedGroup(bettor, creator);

  console.log('3) Kuriam quest\'a kaip creator (assigned_to atsitiktinai - bus bettor)');
  let quest = null;
  for (let i = 0; i < 5; i++) {
    const q = await api('POST', '/api/tasks', creator.token, {
      title: 'Bets test quest',
      description: 'Setup quest statymams',
      bettingIndex: 3,
      groupId,
    });
    if (!q.ok) throw new Error(`POST /api/tasks: ${JSON.stringify(q.data)}`);
    console.log(`   quest id=${q.data.id} assigned_to=${q.data.assignedTo} (try ${i + 1})`);
    if (q.data.assignedTo === bettor.userId) { quest = q.data; break; }
  }
  if (!quest) throw new Error('Po 5 bandymu assigned_to neatitinka bettor');

  console.log(`4) Nustatome bettor balansa = ${INITIAL_BALANCE}`);
  await setBalance(bettor.userId, bettor.token, INITIAL_BALANCE);
  console.log('   balansas atnaujintas');

  console.log('5) Iraso i Postman env');
  writeEnv({
    token: bettor.token,
    tokenOther: creator.token,
    questId: quest.id,
    initialBalance: INITIAL_BALANCE,
  });
  console.log(`   ${path.relative(process.cwd(), POSTMAN_ENV)} atnaujintas`);

  console.log('\nSetup baigtas. Galima paleisti:');
  console.log('   npx newman run postman/bets-testai/Betcha-Bets.postman_collection.json -e postman/bets-testai/Betcha-Bets.postman_environment.json');
}

main().catch((e) => { console.error('FAIL:', e.message); process.exit(1); });
