// Вход и вступление по ссылке на настоящем Postgres с миграциями 001–004.
// Запускается, только если задан TEST_DATABASE_URL (в CI — чистая база в контейнере).
// Никогда не указывайте здесь рабочую базу: тест создаёт свои группы и пользователей.

import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { signInitData } from '../api/_lib/auth';
import { closeDb, db } from '../api/_lib/db';
import { CONSENT_DOC_VERSION } from '../api/_lib/profile';
import { route } from '../api/_lib/router';

const url = process.env.TEST_DATABASE_URL;
const BOT_TOKEN = '123456789:TEST_ONLY_not_a_real_token';
const opts = { skip: url ? false : 'нет TEST_DATABASE_URL' };

let groupId = '';
const run = Date.now().toString(36);
const groupToken = `g_${run}_group_link`;
const smallToken = `g_${run}_two_places`;
const expiredToken = `g_${run}_expired_xx`;
const teacherToken = `t_${run}_teacher_xx`;

before(async () => {
  if (!url) return;
  process.env.DATABASE_URL = url;
  process.env.BOT_TOKEN = BOT_TOKEN;
  const sql = db();
  [{ id: groupId }] = await sql<{ id: string }[]>`insert into groups (title) values ('ИС-21 тест') returning id`;
  await sql`
    insert into invites (token, group_id, max_uses, expires_at) values
      (${groupToken},   ${groupId}, null, now() + interval '14 days'),
      (${smallToken},   ${groupId}, 2,    now() + interval '14 days'),
      (${expiredToken}, ${groupId}, null, now() - interval '1 day')`;
  await sql`
    insert into invites (token, group_id, role, full_name)
    values (${teacherToken}, ${groupId}, 'teacher', 'Ахметова Сауле Ериковна')`;
});

after(async () => {
  if (url) await closeDb();
});

let nextUserId = Math.floor(Date.now() / 1000) * 1000;

function initData(userId: number, startParam?: string): string {
  const fields: Record<string, string> = {
    auth_date: String(Math.floor(Date.now() / 1000)),
    user: JSON.stringify({ id: userId, first_name: 'Тест', language_code: 'kk' }),
  };
  if (startParam) fields.start_param = startParam;
  return new URLSearchParams({ ...fields, hash: signInitData(fields, BOT_TOKEN) }).toString();
}

async function call(method: string, path: string, userId: number, opts: { startParam?: string; body?: unknown } = {}) {
  const res = await route(
    new Request(`http://localhost${path}`, {
      method,
      headers: { 'x-telegram-init-data': initData(userId, opts.startParam), 'content-type': 'application/json' },
      body: opts.body === undefined ? undefined : JSON.stringify(opts.body),
    }),
  );
  return { status: res.status, body: (await res.json()) as any };
}

test('новый студент по ссылке группы → вступил, нужно ФИО, год, согласие', opts, async () => {
  const me = await call('GET', '/api/me', ++nextUserId, { startParam: groupToken });
  assert.equal(me.status, 200);
  assert.equal(me.body.join.status, 'joined');
  assert.equal(me.body.groups.length, 1);
  assert.equal(me.body.groups[0].role, 'student');
  assert.equal(me.body.language, 'kk');
  assert.deepEqual(me.body.needs, ['full_name', 'birth_year', 'consent']);
  assert.equal(me.body.can_save_progress, false);
  assert.equal(me.body.user.telegram_user_id, undefined);
});

test('повторное открытие той же ссылки → already_member, место не расходуется', opts, async () => {
  const id = ++nextUserId;
  await call('GET', '/api/me', id, { startParam: smallToken });
  const again = await call('GET', '/api/me', id, { startParam: smallToken });
  assert.equal(again.body.join.status, 'already_member');
  const sql = db();
  const [{ uses }] = await sql<{ uses: number }[]>`select uses from invites where token = ${smallToken}`;
  assert.equal(uses, 1);
});

test('лимит мест: второй вступил, третий — full', opts, async () => {
  assert.equal((await call('GET', '/api/me', ++nextUserId, { startParam: smallToken })).body.join.status, 'joined');
  const third = await call('GET', '/api/me', ++nextUserId, { startParam: smallToken });
  assert.equal(third.body.join.status, 'full');
  assert.equal(third.body.groups.length, 0);
});

test('истёкшая и несуществующая ссылки', opts, async () => {
  assert.equal((await call('GET', '/api/me', ++nextUserId, { startParam: expiredToken })).body.join.status, 'expired');
  const unknown = await call('GET', '/api/me', ++nextUserId, { startParam: `g_${run}_no_such_link` });
  assert.equal(unknown.body.join.status, 'invalid');
});

test('демо-параметр startapp=student — не приглашение', opts, async () => {
  assert.equal((await call('GET', '/api/me', ++nextUserId, { startParam: 'student' })).body.join, null);
});

test('отозванная ссылка', opts, async () => {
  const token = `g_${run}_revoked_xx`;
  await db()`insert into invites (token, group_id, max_uses, expires_at, revoked_at)
             values (${token}, ${groupId}, null, now() + interval '1 day', now())`;
  assert.equal((await call('GET', '/api/me', ++nextUserId, { startParam: token })).body.join.status, 'revoked');
});

test('персональное приглашение преподавателя: роль и ФИО из списка, ФИО не меняется', opts, async () => {
  const id = ++nextUserId;
  const me = await call('GET', '/api/me', id, { startParam: teacherToken });
  assert.equal(me.body.join.status, 'joined');
  assert.equal(me.body.user.role, 'teacher');
  assert.equal(me.body.user.full_name, 'Ахметова Сауле Ериковна');
  assert.equal(me.body.user.full_name_locked, true);
  assert.equal(me.body.groups[0].role, 'teacher');
  const rename = await call('POST', '/api/me', id, { body: { full_name: 'Другое Имя' } });
  assert.equal(rename.status, 409);
  // одноразовое: второй человек по той же ссылке не пройдёт
  assert.equal((await call('GET', '/api/me', ++nextUserId, { startParam: teacherToken })).body.join.status, 'full');
});

test('взрослый: ФИО + год + согласие → можно сохранять прогресс', opts, async () => {
  const id = ++nextUserId;
  await call('GET', '/api/me', id, { startParam: groupToken });
  const saved = await call('POST', '/api/me', id, { body: { full_name: ' Иванова  Айгерим ', birth_year: 2000, ui_language: 'ru' } });
  assert.equal(saved.status, 200);
  assert.equal(saved.body.user.full_name, 'Иванова Айгерим');
  assert.equal(saved.body.language, 'ru');
  assert.deepEqual(saved.body.needs, ['consent']);

  const outdated = await call('POST', '/api/consent', id, { body: { doc_version: 'old' } });
  assert.equal(outdated.status, 409);
  const ok = await call('POST', '/api/consent', id, { body: { doc_version: CONSENT_DOC_VERSION } });
  assert.equal(ok.status, 200);
  await call('POST', '/api/consent', id, { body: { doc_version: CONSENT_DOC_VERSION } }); // повтор — без дубля

  const me = await call('GET', '/api/me', id);
  assert.deepEqual(me.body.needs, []);
  assert.equal(me.body.can_save_progress, true);
  const sql = db();
  const [{ n }] = await sql<{ n: number }[]>`
    select count(*)::int as n from consents c join users u on u.id = c.user_id where u.id = ${me.body.user.id}`;
  assert.equal(n, 1);
});

test('младше 18: после согласия всё равно ждём согласия родителя; год не переписать', opts, async () => {
  const id = ++nextUserId;
  await call('POST', '/api/me', id, { body: { full_name: 'Сейткали Әлия', birth_year: 2010 } });
  const me = await call('POST', '/api/consent', id, { body: { doc_version: CONSENT_DOC_VERSION } })
    .then(() => call('GET', '/api/me', id));
  assert.equal(me.body.minor, true);
  assert.deepEqual(me.body.needs, ['parental_consent']);
  assert.equal(me.body.can_save_progress, false);
  const cheat = await call('POST', '/api/me', id, { body: { birth_year: 2000 } });
  assert.equal(cheat.status, 409);
});

test('плохие данные → 400 с понятным текстом', opts, async () => {
  const id = ++nextUserId;
  assert.equal((await call('POST', '/api/me', id, { body: { full_name: '123' } })).status, 400);
  assert.equal((await call('POST', '/api/me', id, { body: { birth_year: 1900 } })).status, 400);
  assert.equal((await call('POST', '/api/me', id, { body: { ui_language: 'en' } })).status, 400);
});
