// Кабинет куратора (#9) на настоящем Postgres с миграциями 001–005.
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
let nextTg = Math.floor(Date.now() / 1000) * 1000 + 500_000;
let groupId = '';
let otherGroupId = '';
let curatorTg = 0;
let strangerTg = 0; // преподаватель другой группы
let adminTg = 0;

before(async () => {
  if (!url) return;
  process.env.DATABASE_URL = url;
  process.env.BOT_TOKEN = BOT_TOKEN;
  const sql = db();
  [{ id: groupId }] = await sql<{ id: string }[]>`insert into groups (title) values ('ИС-21 кабинет') returning id`;
  [{ id: otherGroupId }] = await sql<{ id: string }[]>`insert into groups (title) values ('ПР-22 кабинет') returning id`;
  const staff = async (role: 'teacher' | 'admin', group: string | null) => {
    const tg = ++nextTg;
    const [{ id }] = await sql<{ id: string }[]>`
      insert into users (telegram_user_id, full_name, full_name_source, birth_year, role)
      values (${tg}, 'Куратор Тестовый', 'roster', 1985, ${role}) returning id`;
    if (group) await sql`insert into group_members (group_id, user_id, role) values (${group}, ${id}, 'teacher')`;
    return tg;
  };
  curatorTg = await staff('teacher', groupId);
  strangerTg = await staff('teacher', otherGroupId);
  adminTg = await staff('admin', null);
});

after(async () => {
  if (url) await closeDb();
});

function initData(telegramId: number, startParam?: string): string {
  const fields: Record<string, string> = {
    auth_date: String(Math.floor(Date.now() / 1000)),
    user: JSON.stringify({ id: telegramId, first_name: 'Тест', language_code: 'ru' }),
  };
  if (startParam) fields.start_param = startParam;
  return new URLSearchParams({ ...fields, hash: signInitData(fields, BOT_TOKEN) }).toString();
}

async function call(method: string, path: string, tg: number, o: { startParam?: string; body?: unknown } = {}) {
  const res = await route(
    new Request(`http://localhost${path}`, {
      method,
      headers: { 'x-telegram-init-data': initData(tg, o.startParam), 'content-type': 'application/json' },
      body: o.body === undefined ? undefined : JSON.stringify(o.body),
    }),
  );
  return { status: res.status, body: (await res.json()) as any };
}

async function addStudent(o: { name?: string; birth_date?: string; birth_year?: number } = {}) {
  const body: Record<string, unknown> = { group_id: groupId, full_name: o.name ?? 'Нургалиева Камила' };
  if (o.birth_date) body.birth_date = o.birth_date;
  else body.birth_year = o.birth_year ?? 2000;
  const r = await call('POST', '/api/curator/students', curatorTg, { body });
  assert.equal(r.status, 201, JSON.stringify(r.body));
  return r.body.student;
}

test('кабинет — только преподавателям: студент и незнакомый Telegram получают 403', opts, async () => {
  assert.equal((await call('GET', '/api/curator/groups', ++nextTg)).status, 403);
  const s = await addStudent({ name: 'Студент Обычный' });
  const tg = ++nextTg;
  await call('GET', '/api/me', tg, { startParam: s.invite.token });
  assert.equal((await call('GET', '/api/curator/groups', tg)).status, 403);
});

test('куратор видит свои группы, админ — все', opts, async () => {
  const mine = await call('GET', '/api/curator/groups', curatorTg);
  assert.equal(mine.status, 200);
  assert.deepEqual(mine.body.groups.map((g: any) => g.id), [groupId]);
  const all = await call('GET', '/api/curator/groups', adminTg);
  const ids = all.body.groups.map((g: any) => g.id);
  assert.ok(ids.includes(groupId) && ids.includes(otherGroupId));
});

test('завести студента → личная ссылка i_ + 16 символов, срок 30 дней', opts, async () => {
  const s = await addStudent({ name: 'Абенова Диана', birth_date: '2009-04-27' });
  assert.match(s.invite.token, /^i_[A-Za-z0-9]{16}$/);
  const days = (Date.parse(s.invite.expires_at) - Date.now()) / 86_400_000;
  assert.ok(days > 29 && days <= 30.01);
  assert.equal(s.linked, false);
  assert.equal(s.minor, true);
  assert.deepEqual(s.needs, ['consent', 'parental_consent']);
});

test('неверные данные студента — 400, чужая группа — 404', opts, async () => {
  const bad = async (body: Record<string, unknown>) => (await call('POST', '/api/curator/students', curatorTg, { body })).status;
  assert.equal(await bad({ group_id: groupId, full_name: 'Камила', birth_year: 2005 }), 400); // только имя
  assert.equal(await bad({ group_id: groupId, full_name: 'Иванова Анна' }), 400); // без года
  assert.equal(await bad({ group_id: groupId, full_name: 'Иванова Анна', birth_date: '2009-02-30' }), 400);
  assert.equal(await bad({ group_id: otherGroupId, full_name: 'Иванова Анна', birth_year: 2005 }), 404);
});

test('студент входит по ссылке → в списке «вошёл», ссылка использована', opts, async () => {
  const s = await addStudent({ name: 'Сейткалиев Әлихан', birth_year: 2005 });
  const tg = ++nextTg;
  const me = await call('GET', '/api/me', tg, { startParam: s.invite.token });
  assert.equal(me.body.join.status, 'joined');
  const list = await call('GET', `/api/curator/students?group_id=${groupId}`, curatorTg);
  const row = list.body.students.find((x: any) => x.id === s.id);
  assert.equal(row.linked, true);
  assert.equal(row.invite, null);
  assert.equal(row.telegram_user_id, undefined);
});

test('новая ссылка отзывает прежнюю: старой войти нельзя', opts, async () => {
  const s = await addStudent({ name: 'Тулегенов Тимур' });
  const r = await call('POST', `/api/curator/students/${s.id}/invite`, curatorTg);
  assert.equal(r.status, 200);
  assert.notEqual(r.body.invite.token, s.invite.token);
  assert.equal((await call('GET', '/api/me', ++nextTg, { startParam: s.invite.token })).body.join.status, 'revoked');
  assert.equal((await call('GET', '/api/me', ++nextTg, { startParam: r.body.invite.token })).body.join.status, 'joined');
});

test('согласие родителя: отметка куратора включает сохранение прогресса у младше 18', opts, async () => {
  const s = await addStudent({ name: 'Мусина Жанель', birth_date: '2010-01-15' });
  const tg = ++nextTg;
  await call('GET', '/api/me', tg, { startParam: s.invite.token });
  await call('POST', '/api/consent', tg, { body: { doc_version: CONSENT_DOC_VERSION } });
  assert.equal((await call('GET', '/api/me', tg)).body.can_save_progress, false);

  const noRef = await call('POST', `/api/curator/students/${s.id}/parental`, curatorTg, { body: { parent_name: 'Мусина Г.' } });
  assert.equal(noRef.status, 400);
  const mark = await call('POST', `/api/curator/students/${s.id}/parental`, curatorTg, {
    body: { parent_name: 'Мусина Гульнара', document_ref: 'личное дело № 7' },
  });
  assert.equal(mark.status, 200);
  assert.equal(mark.body.student.parental.document_ref, 'личное дело № 7');
  assert.equal((await call('GET', '/api/me', tg)).body.can_save_progress, true);
  assert.equal((await call('POST', `/api/curator/students/${s.id}/parental`, curatorTg, {
    body: { parent_name: 'Мусина Гульнара', document_ref: 'личное дело № 7' },
  })).status, 409);

  const undo = await call('DELETE', `/api/curator/students/${s.id}/parental`, curatorTg);
  assert.equal(undo.body.student.parental, null);
  assert.equal((await call('GET', '/api/me', tg)).body.can_save_progress, false);
});

test('исправить ФИО — закрывает обращение «ошибка в ФИО»', opts, async () => {
  const s = await addStudent({ name: 'Ермекова Мадна', birth_year: 2004 });
  const tg = ++nextTg;
  await call('GET', '/api/me', tg, { startParam: s.invite.token });
  assert.equal((await call('POST', '/api/help', tg, { body: { kind: 'name_error', text: 'Мадина, а не Мадна' } })).status, 200);
  let row = (await call('GET', `/api/curator/students?group_id=${groupId}`, curatorTg)).body.students.find((x: any) => x.id === s.id);
  assert.equal(row.name_errors, 1);
  const fix = await call('PATCH', `/api/curator/students/${s.id}`, curatorTg, { body: { full_name: 'Ермекова Мадина' } });
  assert.equal(fix.status, 200);
  assert.equal(fix.body.student.full_name, 'Ермекова Мадина');
  assert.equal(fix.body.student.name_errors, 0);
  assert.equal((await call('GET', '/api/me', tg)).body.user.full_name, 'Ермекова Мадина');
});

test('чужой куратор не видит и не меняет студентов этой группы', opts, async () => {
  const s = await addStudent({ name: 'Омарова Сабина' });
  assert.equal((await call('GET', `/api/curator/students?group_id=${groupId}`, strangerTg)).status, 404);
  assert.equal((await call('POST', `/api/curator/students/${s.id}/invite`, strangerTg)).status, 404);
  assert.equal((await call('PATCH', `/api/curator/students/${s.id}`, strangerTg, { body: { full_name: 'Взлом Взломов' } })).status, 404);
  assert.equal((await call('POST', `/api/curator/students/${s.id}/unlink`, strangerTg)).status, 404);
  assert.equal((await call('POST', `/api/curator/students/${s.id}/parental`, adminTg, {
    body: { parent_name: 'Омарова А.', document_ref: 'список от 01.09' },
  })).status, 200); // админ колледжа — может
});

test('отвязать Telegram: чужой выходит, согласие на ПД отозвано, новая ссылка — настоящему студенту', opts, async () => {
  const s = await addStudent({ name: 'Калиев Арман', birth_year: 2003 });
  const thief = ++nextTg;
  await call('GET', '/api/me', thief, { startParam: s.invite.token });
  await call('POST', '/api/consent', thief, { body: { doc_version: CONSENT_DOC_VERSION } });

  const un = await call('POST', `/api/curator/students/${s.id}/unlink`, curatorTg);
  assert.equal(un.status, 200);
  assert.equal(un.body.student.linked, false);
  assert.equal(un.body.student.has_consent, false);
  assert.equal((await call('GET', '/api/me', thief)).body.registered, false);

  const inv = await call('POST', `/api/curator/students/${s.id}/invite`, curatorTg);
  const real = ++nextTg;
  assert.equal((await call('GET', '/api/me', real, { startParam: inv.body.invite.token })).body.join.status, 'joined');
  assert.equal((await call('GET', '/api/me', real)).body.user.id, s.id);
});

test('список группы разом: всё или ничего, повторы и ошибки — по номерам строк', opts, async () => {
  const bad = await call('POST', '/api/curator/students/bulk', curatorTg, { body: { group_id: groupId, students: [
    { full_name: 'Бекова Аружан', birth_date: '2009-09-01' },
    { full_name: 'Аружан', birth_year: 2009 },
    { full_name: 'Бекова Аружан', birth_date: '2009-09-01' },
  ] } });
  assert.equal(bad.status, 400);
  assert.deepEqual(bad.body.rows.map((r: any) => r.index), [1, 2]);
  const sql = db();
  const [{ n }] = await sql<{ n: number }[]>`
    select count(*)::int as n from users u join group_members m on m.user_id = u.id
     where m.group_id = ${groupId} and u.full_name = 'Бекова Аружан'`;
  assert.equal(n, 0); // ничего не записали

  const ok = await call('POST', '/api/curator/students/bulk', curatorTg, { body: { group_id: groupId, students: [
    { full_name: 'Бекова Аружан', birth_date: '2009-09-01' },
    { full_name: 'Жумабаев Нурлан', birth_year: 2005 },
  ] } });
  assert.equal(ok.status, 201);
  assert.equal(ok.body.created, 2);
  assert.ok(ok.body.students.every((x: any) => /^i_[A-Za-z0-9]{16}$/.test(x.invite.token)));

  const again = await call('POST', '/api/curator/students/bulk', curatorTg, { body: { group_id: groupId, students: [{ full_name: 'жумабаев нурлан', birth_year: 2005 }] } });
  assert.equal(again.status, 400);
  assert.match(again.body.rows[0].message, /уже есть/);
  assert.equal((await call('POST', '/api/curator/students/bulk', strangerTg, { body: { group_id: groupId, students: [{ full_name: 'Взлом Взломов', birth_year: 2005 }] } })).status, 404);
});

test('повтор при одиночном добавлении — 409, с подтверждением (тёзка) — можно; ссылка вошедшему — 409', opts, async () => {
  const s = await addStudent({ name: 'Ахметова Дана', birth_year: 2004 });
  const dup = await call('POST', '/api/curator/students', curatorTg, { body: { group_id: groupId, full_name: 'ахметова дана', birth_year: 2004 } });
  assert.equal(dup.status, 409);
  assert.equal(dup.body.error, 'duplicate');
  const forced = await call('POST', '/api/curator/students', curatorTg, { body: { group_id: groupId, full_name: 'Ахметова Дана', birth_year: 2004, force: true } });
  assert.equal(forced.status, 201);

  await call('GET', '/api/me', ++nextTg, { startParam: s.invite.token });
  const again = await call('POST', `/api/curator/students/${s.id}/invite`, curatorTg);
  assert.equal(again.status, 409);
  assert.equal(again.body.error, 'already_linked');
});

test('двойное нажатие «отметить согласие» — одна отметка', opts, async () => {
  const s = await addStudent({ name: 'Ермеков Санжар', birth_date: '2010-05-05' });
  const body = { parent_name: 'Ермекова Асель', document_ref: 'личное дело № 3' };
  const [a, b] = await Promise.all([
    call('POST', `/api/curator/students/${s.id}/parental`, curatorTg, { body }),
    call('POST', `/api/curator/students/${s.id}/parental`, curatorTg, { body }),
  ]);
  assert.deepEqual([a.status, b.status].sort(), [200, 409]);
  const [{ n }] = await db()<{ n: number }[]>`
    select count(*)::int as n from consents where user_id = ${s.id} and kind = 'parental' and revoked_at is null`;
  assert.equal(n, 1);
});

test('неизвестный путь и метод', opts, async () => {
  assert.equal((await call('GET', '/api/curator/students/not-a-uuid/invite', curatorTg)).status, 405);
  assert.equal((await call('POST', '/api/curator/students/not-a-uuid/invite', curatorTg)).status, 404);
});
