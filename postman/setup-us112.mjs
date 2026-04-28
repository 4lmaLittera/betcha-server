#!/usr/bin/env node
// Automatinis US#112 Postman setup'as.
//
// Atlieka:
// 1) Supabase signup (jei nera) ir login dviem test users
// 2) Sukuria/randa grupe abiem
// 3) Kaip user2 sukuria 2 quest'us; sistema atsitiktinai priskirs viena
//    is grupes nariu, isskyrus kureja -> bus user1
// 4) Patikrina, kad assigned_to = user1
// 5) Iraso tokens + questId's i Betcha.postman_environment.json
//
// Naudojimas:
//   node postman/setup-us112.mjs

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ENV_FILE = path.join(__dirname, '..', '.env');
const POSTMAN_ENV = path.join(__dirname, 'Betcha.postman_environment.json');
const API_BASE = process.env.API_BASE || 'http://localhost:3000';

const USERS = {
  user1: { email: 'postman1@gmail.com', password: '12345678' },
  user2: { email: 'postman2@gmail.com', password: '12345678' },
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
  console.error('Trūksta SUPABASE_URL/SUPABASE_KEY .env faile');
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
  const login = await supabaseAuth('token?grant_type=password', {
    email,
    password,
  });
  if (login.ok && login.data.access_token) {
    return { token: login.data.access_token, userId: login.data.user.id };
  }
  console.log(`  signup → ${email}`);
  const signup = await supabaseAuth('signup', { email, password });
  if (!signup.ok) {
    throw new Error(`Signup nepavyko ${email}: ${JSON.stringify(signup.data)}`);
  }
  if (signup.data.access_token) {
    return { token: signup.data.access_token, userId: signup.data.user.id };
  }
  // signup gali grazinti tik user be tokeno; bandom login
  const retry = await supabaseAuth('token?grant_type=password', {
    email,
    password,
  });
  if (!retry.ok || !retry.data.access_token) {
    throw new Error(
      `Login po signup nepavyko ${email}: ${JSON.stringify(retry.data)}`,
    );
  }
  return { token: retry.data.access_token, userId: retry.data.user.id };
}

async function api(method, path, token, body) {
  const headers = { Authorization: `Bearer ${token}` };
  if (body) headers['Content-Type'] = 'application/json';
  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let data;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }
  return { ok: res.ok, status: res.status, data };
}

async function getOrCreateSharedGroup(u1, u2) {
  const u1Groups = await api('GET', '/api/groups', u1.token);
  if (!u1Groups.ok)
    throw new Error(`GET /api/groups u1: ${JSON.stringify(u1Groups.data)}`);
  const u2Groups = await api('GET', '/api/groups', u2.token);
  if (!u2Groups.ok)
    throw new Error(`GET /api/groups u2: ${JSON.stringify(u2Groups.data)}`);

  const u1Set = new Set((u1Groups.data || []).map((g) => g.id));
  const shared = (u2Groups.data || []).find((g) => u1Set.has(g.id));
  if (shared) {
    console.log(`  bendra grupe rasta: ${shared.id} (${shared.name})`);
    return shared.id;
  }

  // Sukuriam u1 grupe
  const create = await api('POST', '/api/groups', u1.token, {
    name: 'Postman Test Group',
  });
  if (!create.ok)
    throw new Error(`Sukurti grupe nepavyko: ${JSON.stringify(create.data)}`);
  console.log(
    `  grupe sukurta: ${create.data.id} (invite=${create.data.invite_code})`,
  );

  // u2 prisijungia
  const join = await api('POST', '/api/groups/join', u2.token, {
    inviteCode: create.data.invite_code,
  });
  if (!join.ok && join.status !== 409)
    throw new Error(`Join nepavyko: ${JSON.stringify(join.data)}`);
  console.log(`  u2 prisijunge prie grupes`);

  return create.data.id;
}

async function uploadInitialPhoto(token) {
  const filePath = path.join(__dirname, 'fixtures', 'messy-kitchen.jpg');
  const buffer = fs.readFileSync(filePath);
  const boundary = `----boundary${Date.now()}`;
  const body = Buffer.concat([
    Buffer.from(
      `--${boundary}\r\nContent-Disposition: form-data; name="photo"; filename="messy-kitchen.jpg"\r\nContent-Type: image/jpeg\r\n\r\n`,
    ),
    buffer,
    Buffer.from(`\r\n--${boundary}--\r\n`),
  ]);
  const res = await fetch(`${API_BASE}/api/analyze`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': `multipart/form-data; boundary=${boundary}`,
    },
    body,
  });
  const data = await res.json();
  if (!res.ok || !data.photoUrl) {
    throw new Error(
      `Nepavyko ikelti pradines nuotraukos: ${JSON.stringify(data)}`,
    );
  }
  return data.photoUrl;
}

async function createQuest(creatorToken, groupId, title, photoUrl) {
  const res = await api('POST', '/api/tasks', creatorToken, {
    title,
    description: `Setup test quest ${title}`,
    bettingIndex: 3,
    groupId,
    photoUrl,
  });
  if (!res.ok)
    throw new Error(
      `POST /api/tasks (${title}) nepavyko: ${JSON.stringify(res.data)}`,
    );
  return res.data;
}

function writeEnv(updates) {
  const env = JSON.parse(fs.readFileSync(POSTMAN_ENV, 'utf-8'));
  for (const v of env.values) {
    if (updates[v.key] !== undefined) v.value = updates[v.key];
  }
  fs.writeFileSync(POSTMAN_ENV, JSON.stringify(env, null, 2) + '\n');
}

async function main() {
  console.log('1) Login/signup user1 + user2');
  const u1 = await loginOrSignup(USERS.user1.email, USERS.user1.password);
  console.log(`   user1=${USERS.user1.email} id=${u1.userId}`);
  const u2 = await loginOrSignup(USERS.user2.email, USERS.user2.password);
  console.log(`   user2=${USERS.user2.email} id=${u2.userId}`);

  console.log('2) Bendra grupe');
  const groupId = await getOrCreateSharedGroup(u1, u2);

  console.log('3) Ikeliam pradine messy nuotrauka i Storage (per /api/analyze)');
  const initialUrl = await uploadInitialPhoto(u1.token);
  console.log(`   initial_image_url=${initialUrl}`);

  console.log('4) Kuriam 2 quest\'us kaip user2 (kad assigned_to taptu user1)');
  const MAX_RETRY = 5;
  const targets = ['Test rejected', 'Test approved'];
  const created = [];
  for (const title of targets) {
    let ok = null;
    for (let i = 0; i < MAX_RETRY; i++) {
      const q = await createQuest(u2.token, groupId, title, initialUrl);
      console.log(
        `   ${title}: id=${q.id} assigned_to=${q.assignedTo} (try ${i + 1})`,
      );
      if (q.assignedTo === u1.userId) {
        ok = q;
        break;
      }
    }
    if (!ok)
      throw new Error(
        `Po ${MAX_RETRY} bandymu assigned_to vis nera u1 — patikrink, ar grupeje yra tik u1+u2 (3+ nariu del randomizacijos gali butu kitas)`,
      );
    created.push(ok);
  }

  console.log('5) Iraso i Postman env');
  writeEnv({
    token: u1.token,
    tokenOther: u2.token,
    questIdRejected: created[0].id,
    questIdApproved: created[1].id,
  });
  console.log(`   ${path.relative(process.cwd(), POSTMAN_ENV)} atnaujintas`);

  console.log('\n✅ Setup baigtas. Galima paleisti:');
  console.log('   npm run test:postman:us112');
}

main().catch((e) => {
  console.error('❌', e.message);
  process.exit(1);
});
