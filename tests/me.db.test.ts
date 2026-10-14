// Вход по личной ссылке на настоящем Postgres с миграциями 001–005 (решение 14.10.2026).
// Запускается, только если задан TEST_DATABASE_URL (в CI — чистая база в контейнере).
// Никогда не указывайте здесь рабочую базу: тест создаёт свои группы и пользователей.

import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { signInitData } from '../api/_lib/auth';
import { closeDb, db } from '../api/_lib/db';
import { CONSENT_DOC_VERSION, todayInKazakhstan } from '../api/_lib/profile';
import { route } from '../api/_lib/router';

const url = process.env.TEST_DATABASE_URL;
const BOT_TOKEN = '123456789:TEST_ONLY_not_a_real_token';
const opts = { skip: url ? false : 'нет TEST_DATABASE_URL' };
const run = Date.now().toString(36);
let groupId = '';
let seq = 0;
let nextTelegramId = Math.floor(Date.now() / 1000) * 1000;

before(async () => {
  if (!url) return;
  process.env.DATABASE_URL = url;
  process.env.BOT_TOKEN = BOT_TOKEN;
  const sql = db();
  [{ id: groupId }] = await sql<{ id: string }[]>`insert into groups (title) values ('ИС-21 тест') returning id`;
});

after(async () => {
  if (url) await closeDb();
});

// Куратор заводит студента и выдаёт ему личную ссылку — как будет делать кабинет (#9)
async function rosterStudent(
  o: {
    name?: string | null;
    year?: number | null;
    date?: string; // YYYY-MM-DD — год берётся из даты
    role?: 'student' | 'teacher';
    parental?: boolean;
    expires?: string;
    revoked?: boolean;
  } = {},
) {
  const sql = db();
  const role = o.role ?? 'student';
  const year = o.date ? Number(o.date.slice(0, 4)) : o.year === undefined ? 2000 : o.year;
  const [{ id }] = await sql<{ id: string }[]>`
    insert into users (full_name, full_name_source, birth_year, birth_date, role)
    values (${o.name === undefined ? 'Иванова Айгерим' : o.name}, 'roster', ${year}, ${o.date ?? null}, ${role})
    returning id`;
  await sql`insert into group_members (group_id, user_id, role) values (${groupId}, ${id}, ${role})`;
  if (o.parental) {
    await sql`insert into consents (user_id, kind, doc_version, granted_via, parent_name, document_ref)
              values (${id}, 'parental', 'paper', 'paper', 'Иванова Г.', 'личное дело № 12')`;
  }
  const token = `s_${run}_${String(++seq).padStart(6, '0')}`;
  await sql`
    insert into invites (token, group_id, role, user_id, expires_at, revoked_at)
    values (${token}, ${groupId}, ${role}, ${id},
            ${o.expires === 'past' ? new Date(Date.now() - 86_400_000) : null},
            ${o.revoked ? new Date() : null})`;
  return { id, token };
}

function initData(telegramId: number, startParam?: string): string {
  const fields: Record<string, string> = {
    auth_date: String(Math.floor(Date.now() / 1000)),
    user: JSON.stringify({ id: telegramId, first_name: 'Тест', language_code: 'kk' }),
  };
  if (startParam) fields.start_param = startParam;
  return new URLSearchParams({ ...fields, hash: signInitData(fields, BOT_TOKEN) }).toString();
}

async function call(method: string, path: string, telegramId: number, o: { startParam?: string; body?: unknown } = {}) {
  const res = await route(
    new Request(`http://localhost${path}`, {
      method,
      headers: { 'x-telegram-init-data': initData(telegramId, o.startParam), 'content-type': 'application/json' },
      body: o.body === undefined ? undefined : JSON.stringify(o.body),
    }),
  );
  return { status: res.status, body: (await res.json()) as any };
}

test('без личной ссылки — демо, в базу ничего не пишем', opts, async () => {
  const tg = ++nextTelegramId;
  const me = await call('GET', '/api/me', tg);
  assert.equal(me.status, 200);
  assert.equal(me.body.registered, false);
  assert.equal(me.body.can_save_progress, false);
  const sql = db();
  const [{ n }] = await sql<{ n: number }[]>`select count(*)::int as n from users where telegram_user_id = ${tg}`;
  assert.equal(n, 0);
  assert.equal((await call('POST', '/api/consent', tg, { body: { doc_version: CONSENT_DOC_VERSION } })).status, 403);
});

test('демо-параметр startapp=student — не приглашение', opts, async () => {
  const me = await call('GET', '/api/me', ++nextTelegramId, { startParam: 'student' });
  assert.equal(me.body.join, null);
  assert.equal(me.body.registered, false);
});

test('личная ссылка → Telegram привязан, ФИО и год от куратора, группа', opts, async () => {
  const s = await rosterStudent({ name: 'Сейткали Әлия', year: 2001 });
  const me = await call('GET', '/api/me', ++nextTelegramId, { startParam: s.token });
  assert.equal(me.status, 200);
  assert.equal(me.body.join.status, 'joined');
  assert.equal(me.body.registered, true);
  assert.equal(me.body.user.id, s.id);
  assert.equal(me.body.user.full_name, 'Сейткали Әлия');
  assert.equal(me.body.groups.length, 1);
  assert.equal(me.body.language, 'kk');
  assert.deepEqual(me.body.needs, ['consent']);
  assert.equal(me.body.user.telegram_user_id, undefined);
});

test('своя ссылка повторно → already_yours; без ссылки — тот же студент', opts, async () => {
  const s = await rosterStudent();
  const tg = ++nextTelegramId;
  await call('GET', '/api/me', tg, { startParam: s.token });
  assert.equal((await call('GET', '/api/me', tg, { startParam: s.token })).body.join.status, 'already_yours');
  assert.equal((await call('GET', '/api/me', tg)).body.user.id, s.id);
});

test('ссылкой уже вошёл другой Telegram → used, второй остаётся в демо', opts, async () => {
  const s = await rosterStudent();
  await call('GET', '/api/me', ++nextTelegramId, { startParam: s.token });
  const other = await call('GET', '/api/me', ++nextTelegramId, { startParam: s.token });
  assert.equal(other.body.join.status, 'used');
  assert.equal(other.body.registered, false);
});

test('Telegram уже привязан к студенту — чужая ссылка не работает', opts, async () => {
  const a = await rosterStudent({ name: 'Первый Студент' });
  const b = await rosterStudent({ name: 'Второй Студент' });
  const tg = ++nextTelegramId;
  await call('GET', '/api/me', tg, { startParam: a.token });
  const me = await call('GET', '/api/me', tg, { startParam: b.token });
  assert.equal(me.body.join.status, 'already_registered');
  assert.equal(me.body.user.id, a.id);
  // ссылка второго студента не израсходована — он войдёт сам
  assert.equal((await call('GET', '/api/me', ++nextTelegramId, { startParam: b.token })).body.join.status, 'joined');
});

test('истёкшая, отозванная и несуществующая ссылки', opts, async () => {
  const expired = await rosterStudent({ expires: 'past' });
  const revoked = await rosterStudent({ revoked: true });
  assert.equal((await call('GET', '/api/me', ++nextTelegramId, { startParam: expired.token })).body.join.status, 'expired');
  assert.equal((await call('GET', '/api/me', ++nextTelegramId, { startParam: revoked.token })).body.join.status, 'revoked');
  const unknown = await call('GET', '/api/me', ++nextTelegramId, { startParam: `s_${run}_no_such_link` });
  assert.equal(unknown.body.join.status, 'invalid');
});

test('ссылку перевыдали: старая отозвана, новая работает', opts, async () => {
  const s = await rosterStudent();
  const sql = db();
  await sql`update invites set revoked_at = now() where token = ${s.token}`;
  const fresh = `s_${run}_reissued_${seq}`;
  await sql`insert into invites (token, group_id, role, user_id) values (${fresh}, ${groupId}, 'student', ${s.id})`;
  const tg = ++nextTelegramId;
  assert.equal((await call('GET', '/api/me', tg, { startParam: s.token })).body.join.status, 'revoked');
  const me = await call('GET', '/api/me', tg, { startParam: fresh });
  assert.equal(me.body.join.status, 'joined');
  assert.equal(me.body.user.id, s.id);
});

test('студент не меняет ФИО и год; язык — может', opts, async () => {
  const s = await rosterStudent();
  const tg = ++nextTelegramId;
  await call('GET', '/api/me', tg, { startParam: s.token });
  assert.equal((await call('POST', '/api/me', tg, { body: { full_name: 'Другое Имя' } })).status, 409);
  assert.equal((await call('POST', '/api/me', tg, { body: { birth_year: 2000 } })).status, 409);
  assert.equal((await call('POST', '/api/me', tg, { body: { ui_language: 'en' } })).status, 400);
  const me = await call('POST', '/api/me', tg, { body: { ui_language: 'ru' } });
  assert.equal(me.status, 200);
  assert.equal(me.body.language, 'ru');
  assert.equal(me.body.user.full_name, 'Иванова Айгерим');
});

test('взрослый: согласие студента → можно сохранять прогресс; без дублей', opts, async () => {
  const s = await rosterStudent({ year: 2000 });
  const tg = ++nextTelegramId;
  await call('GET', '/api/me', tg, { startParam: s.token });
  assert.equal((await call('POST', '/api/consent', tg, { body: { doc_version: 'old' } })).status, 409);
  assert.equal((await call('POST', '/api/consent', tg, { body: { doc_version: CONSENT_DOC_VERSION } })).status, 200);
  await call('POST', '/api/consent', tg, { body: { doc_version: CONSENT_DOC_VERSION } });
  const me = await call('GET', '/api/me', tg);
  assert.deepEqual(me.body.needs, []);
  assert.equal(me.body.can_save_progress, true);
  const sql = db();
  const [{ n }] = await sql<{ n: number }[]>`
    select count(*)::int as n from consents where user_id = ${s.id} and kind = 'personal_data'`;
  assert.equal(n, 1);
});

test('младше 18 без отметки куратора — демо; с отметкой — всё включается', opts, async () => {
  const without = await rosterStudent({ year: 2010 });
  const tg1 = ++nextTelegramId;
  await call('GET', '/api/me', tg1, { startParam: without.token });
  await call('POST', '/api/consent', tg1, { body: { doc_version: CONSENT_DOC_VERSION } });
  const a = await call('GET', '/api/me', tg1);
  assert.equal(a.body.minor, true);
  assert.deepEqual(a.body.needs, ['parental_consent']);
  assert.equal(a.body.can_save_progress, false);

  const withMark = await rosterStudent({ year: 2010, parental: true });
  const tg2 = ++nextTelegramId;
  await call('GET', '/api/me', tg2, { startParam: withMark.token });
  await call('POST', '/api/consent', tg2, { body: { doc_version: CONSENT_DOC_VERSION } });
  const b = await call('GET', '/api/me', tg2);
  assert.deepEqual(b.body.needs, []);
  assert.equal(b.body.can_save_progress, true);
});

test('куратор не внёс год рождения → roster, студент ничего не исправит сам', opts, async () => {
  const s = await rosterStudent({ year: null });
  const me = await call('GET', '/api/me', ++nextTelegramId, { startParam: s.token });
  assert.deepEqual(me.body.needs, ['roster', 'consent']);
  assert.equal(me.body.minor, null);
});

test('приглашение преподавателя → роль teacher', opts, async () => {
  const t = await rosterStudent({ name: 'Ахметова Сауле Ериковна', role: 'teacher' });
  const me = await call('GET', '/api/me', ++nextTelegramId, { startParam: t.token });
  assert.equal(me.body.join.status, 'joined');
  assert.equal(me.body.user.role, 'teacher');
  assert.equal(me.body.groups[0].role, 'teacher');
});

test('«ошибка в ФИО» → обращение куратору в группе студента', opts, async () => {
  const s = await rosterStudent({ name: 'Иванва Айгерим' });
  const tg = ++nextTelegramId;
  await call('GET', '/api/me', tg, { startParam: s.token });
  const res = await call('POST', '/api/help', tg, { body: { kind: 'name_error', text: 'Правильно: Иванова', lesson_id: 'not-a-uuid' } });
  assert.equal(res.status, 200);
  const sql = db();
  const [h] = await sql<{ text: string; group_id: string }[]>`select text, group_id from help_requests where id = ${res.body.id}`;
  assert.equal(h.text, 'Ошибка в ФИО: Правильно: Иванова');
  assert.equal(h.group_id, groupId);
  assert.equal((await call('POST', '/api/help', tg, { body: { text: '' } })).status, 400);
  assert.equal((await call('POST', '/api/help', ++nextTelegramId, { body: { text: 'помогите' } })).status, 403);
});

test('дата рождения: 18 исполнилось вчера — взрослый; исполнится завтра — ждём согласия родителя', opts, async () => {
  // Даты считаем от «сегодня» в Казахстане, как сервер
  const shift = (days: number) => {
    const d = new Date(`${todayInKazakhstan()}T00:00:00Z`);
    d.setUTCDate(d.getUTCDate() + days);
    d.setUTCFullYear(d.getUTCFullYear() - 18);
    return d.toISOString().slice(0, 10);
  };
  const turned = await rosterStudent({ date: shift(-1) });
  const tg1 = ++nextTelegramId;
  await call('GET', '/api/me', tg1, { startParam: turned.token });
  await call('POST', '/api/consent', tg1, { body: { doc_version: CONSENT_DOC_VERSION } });
  const a = await call('GET', '/api/me', tg1);
  assert.equal(a.body.minor, false);
  assert.deepEqual(a.body.needs, []);
  assert.equal(a.body.user.birth_date, undefined); // дату рождения наружу не отдаём

  const notYet = await rosterStudent({ date: shift(1) });
  const tg2 = ++nextTelegramId;
  await call('GET', '/api/me', tg2, { startParam: notYet.token });
  await call('POST', '/api/consent', tg2, { body: { doc_version: CONSENT_DOC_VERSION } });
  const b = await call('GET', '/api/me', tg2);
  assert.equal(b.body.minor, true);
  assert.deepEqual(b.body.needs, ['parental_consent']);
  assert.equal((await call('POST', '/api/me', tg2, { body: { birth_date: '2000-01-01' } })).status, 409);
});
