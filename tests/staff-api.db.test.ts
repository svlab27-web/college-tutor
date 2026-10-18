// Вход сотрудников по ссылке, права по ролям и кабинет администратора колледжа (#63)
// на настоящем Postgres с миграциями 001–007.
// Запускается, только если задан TEST_DATABASE_URL (в CI — чистая база в контейнере).
// Никогда не указывайте здесь рабочую базу: тест создаёт свои группы и пользователей.

import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { signInitData } from '../api/_lib/auth';
import { closeDb, db } from '../api/_lib/db';
import { route } from '../api/_lib/router';

const url = process.env.TEST_DATABASE_URL;
const BOT_TOKEN = '123456789:TEST_ONLY_not_a_real_token';
const opts = { skip: url ? false : 'нет TEST_DATABASE_URL' };
let nextTg = Math.floor(Date.now() / 1000) * 1000 + 700_000;
let groupA = '';
let groupB = '';
let adminTg = 0;
let adminId = '';

before(async () => {
  if (!url) return;
  process.env.DATABASE_URL = url;
  process.env.BOT_TOKEN = BOT_TOKEN;
  const sql = db();
  [{ id: groupA }] = await sql<{ id: string }[]>`insert into groups (title) values ('Сотр-А') returning id`;
  [{ id: groupB }] = await sql<{ id: string }[]>`insert into groups (title) values ('Сотр-Б') returning id`;
  // Первого администратора заводим «скриптом» — прямо в базе, как scripts/staff-sql.ts
  adminTg = ++nextTg;
  [{ id: adminId }] = await sql<{ id: string }[]>`
    insert into users (telegram_user_id, full_name, full_name_source, role)
    values (${adminTg}, 'Админ Колледжа', 'roster', 'teacher') returning id`;
  await sql`insert into staff_roles (user_id, role) values (${adminId}, 'admin')`;
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

// Администратор заводит сотрудника, тот входит по ссылке → его Telegram
async function hire(body: Record<string, unknown>): Promise<{ id: string; tg: number; token: string }> {
  const r = await call('POST', '/api/admin/staff', adminTg, { body });
  assert.equal(r.status, 201, JSON.stringify(r.body));
  const tg = ++nextTg;
  const me = await call('GET', '/api/me', tg, { startParam: r.body.invite.token });
  assert.equal(me.body.join.status, 'joined');
  return { id: r.body.staff.id, tg, token: r.body.invite.token };
}

async function student(group: string): Promise<string> {
  const [{ id }] = await db()<{ id: string }[]>`
    insert into users (full_name, full_name_source, birth_year, role)
    values ('Студент Сотрудников', 'roster', 2000, 'student') returning id`;
  await db()`insert into group_members (group_id, user_id, role) values (${group}, ${id}, 'student')`;
  return id;
}

// ── Вход по ссылке ───────────────────────────────────────────

test('администратор заводит сотрудника → ссылка на 48 ч → вход → кабинет с ролями', opts, async () => {
  const r = await call('POST', '/api/admin/staff', adminTg, {
    body: { full_name: 'Педагогова Анна', assignments: [{ group_id: groupA, role: 'teacher', subject_id: 'python' }] },
  });
  assert.equal(r.status, 201);
  assert.match(r.body.invite.token, /^i_[A-Za-z0-9]{16}$/);
  const hours = (Date.parse(r.body.invite.expires_at) - Date.now()) / 3_600_000;
  assert.ok(hours > 47 && hours <= 48, String(hours));
  assert.equal(r.body.staff.linked, false);

  const tg = ++nextTg;
  const me = await call('GET', '/api/me', tg, { startParam: r.body.invite.token });
  assert.deepEqual(me.body.join, { status: 'joined', staff: true });
  assert.equal(me.body.user.role, 'teacher');
  assert.equal(me.body.staff.admin, false);
  assert.deepEqual(
    me.body.staff.groups.map((g: any) => [g.title, g.curator, g.subjects]),
    [['Сотр-А', false, ['python']]],
  );
  // повторно своей ссылкой — «уже ваша», без группы
  const again = await call('GET', '/api/me', tg, { startParam: r.body.invite.token });
  assert.deepEqual(again.body.join, { status: 'already_yours', staff: true });
});

test('ссылка сотрудника: чужой Telegram после входа — used; Telegram студента — already_registered', opts, async () => {
  const s = await hire({ full_name: 'Кураторова Бота' });
  const other = await call('GET', '/api/me', ++nextTg, { startParam: s.token });
  assert.deepEqual(other.body.join, { status: 'used' });

  const r = await call('POST', '/api/admin/staff', adminTg, { body: { full_name: 'Второй Сотрудник' } });
  const studentTg = ++nextTg;
  const sid = await student(groupA);
  await db()`update users set telegram_user_id = ${studentTg} where id = ${sid}`;
  const me = await call('GET', '/api/me', studentTg, { startParam: r.body.invite.token });
  assert.deepEqual(me.body.join, { status: 'already_registered' });
});

test('просроченная ссылка сотрудника не работает', opts, async () => {
  const r = await call('POST', '/api/admin/staff', adminTg, { body: { full_name: 'Опоздавший Сотрудник' } });
  await db()`update invites set created_at = now() - interval '49 hours', expires_at = now() - interval '1 hour'
              where token = ${r.body.invite.token}`;
  const me = await call('GET', '/api/me', ++nextTg, { startParam: r.body.invite.token });
  assert.deepEqual(me.body.join, { status: 'expired' });
});

// ── Права по ролям ───────────────────────────────────────────

test('педагог: прогресс и обращения своей группы — да; список, ссылки, чужая группа — нет', opts, async () => {
  const t = await hire({ full_name: 'Педагог Питонов', assignments: [{ group_id: groupA, role: 'teacher', subject_id: 'python' }] });
  const sid = await student(groupA);
  assert.equal((await call('GET', `/api/curator/progress?group_id=${groupA}`, t.tg)).status, 200);
  assert.equal((await call('GET', `/api/curator/help?group_id=${groupA}`, t.tg)).status, 200);
  assert.equal((await call('GET', `/api/curator/students?group_id=${groupA}`, t.tg)).status, 404);
  assert.equal((await call('POST', `/api/curator/students/${sid}/invite`, t.tg)).status, 404);
  assert.equal((await call('GET', `/api/curator/progress?group_id=${groupB}`, t.tg)).status, 404);
  const groups = await call('GET', '/api/curator/groups', t.tg);
  assert.deepEqual(groups.body.groups.map((g: any) => [g.title, g.can_manage]), [['Сотр-А', false]]);
});

test('педагог видит в прогрессе только уроки своего предмета', opts, async () => {
  const sql = db();
  for (const subject of ['python', 'math']) {
    await sql`insert into lessons (subject_id, slug, title, content)
              values (${subject}, ${'staff-' + subject}, ${'Урок ' + subject}, '{"steps":[]}')
              on conflict do nothing`;
  }
  const t = await hire({ full_name: 'Математик Числов', assignments: [{ group_id: groupB, role: 'teacher', subject_id: 'math' }] });
  const r = await call('GET', `/api/curator/progress?group_id=${groupB}`, t.tg);
  assert.equal(r.status, 200);
  assert.ok(r.body.lessons.length > 0);
  assert.ok(r.body.lessons.every((l: any) => l.subject === 'math'));
});

test('куратор группы управляет студентами; методист всё видит, ничего не меняет', opts, async () => {
  const c = await hire({ full_name: 'Куратор Группович', assignments: [{ group_id: groupB, role: 'curator' }] });
  const m = await hire({ full_name: 'Методист Сводкина', methodist: true });
  const sid = await student(groupB);
  assert.equal((await call('GET', `/api/curator/students?group_id=${groupB}`, c.tg)).status, 200);
  assert.equal((await call('POST', `/api/curator/students/${sid}/invite`, c.tg)).status, 200);
  assert.equal((await call('GET', `/api/curator/students?group_id=${groupA}`, c.tg)).status, 404);

  const groups = await call('GET', '/api/curator/groups', m.tg);
  assert.deepEqual(groups.body.groups.map((g: any) => g.can_manage), groups.body.groups.map(() => false));
  assert.ok(groups.body.groups.some((g: any) => g.id === groupA) && groups.body.groups.some((g: any) => g.id === groupB));
  assert.equal((await call('GET', `/api/curator/progress?group_id=${groupA}`, m.tg)).status, 200);
  assert.equal((await call('GET', `/api/curator/students?group_id=${groupA}`, m.tg)).status, 404);
  assert.equal((await call('POST', `/api/curator/students/${sid}/invite`, m.tg)).status, 404);
  assert.equal((await call('GET', '/api/admin/staff', m.tg)).status, 403);
});

// ── Администратор колледжа ───────────────────────────────────

test('кабинет администратора — только администратору', opts, async () => {
  const c = await hire({ full_name: 'Просто Куратор', assignments: [{ group_id: groupA, role: 'curator' }] });
  assert.equal((await call('GET', '/api/admin/staff', c.tg)).status, 403);
  assert.equal((await call('POST', '/api/admin/groups', c.tg, { body: { title: 'Чужая' } })).status, 403);
  assert.equal((await call('GET', '/api/admin/staff', ++nextTg)).status, 403);
});

test('группы: завести, переименовать, повтор названия — 409', opts, async () => {
  const title = `ВТ-${nextTg % 100000}`;
  const r = await call('POST', '/api/admin/groups', adminTg, { body: { title, language: 'kk' } });
  assert.equal(r.status, 201);
  assert.equal(r.body.group.language, 'kk');
  assert.equal((await call('POST', '/api/admin/groups', adminTg, { body: { title: title.toLowerCase() } })).status, 409);
  const p = await call('PATCH', `/api/admin/groups/${r.body.group.id}`, adminTg, { body: { title: `${title}а` } });
  assert.equal(p.body.group.title, `${title}а`);
  const list = await call('GET', '/api/admin/groups', adminTg);
  assert.ok(list.body.groups.some((g: any) => g.title === `${title}а`));
  assert.ok(list.body.subjects.some((s: any) => s.id === 'python'));
});

test('назначения: педагогу нужен предмет, повтор — 409, снять — можно', opts, async () => {
  const s = await hire({ full_name: 'Назначаемый Сотрудник' });
  const path = `/api/admin/staff/${s.id}/assignments`;
  assert.equal((await call('POST', path, adminTg, { body: { group_id: groupA, role: 'teacher' } })).status, 400);
  const a = await call('POST', path, adminTg, { body: { group_id: groupA, role: 'curator' } });
  assert.equal(a.status, 201);
  assert.equal((await call('POST', path, adminTg, { body: { group_id: groupA, role: 'curator' } })).status, 409);
  const id = a.body.staff.assignments[0].id;
  assert.equal((await call('GET', `/api/curator/students?group_id=${groupA}`, s.tg)).status, 200);
  assert.equal((await call('DELETE', `${path}/${id}`, adminTg)).status, 200);
  assert.equal((await call('GET', `/api/curator/students?group_id=${groupA}`, s.tg)).status, 404);
});

test('сменил Telegram: без relink — 409, с relink — старый Telegram отвязан, новая ссылка', opts, async () => {
  const s = await hire({ full_name: 'Сменивший Телефон', assignments: [{ group_id: groupA, role: 'curator' }] });
  assert.equal((await call('POST', `/api/admin/staff/${s.id}/invite`, adminTg)).status, 409);
  const r = await call('POST', `/api/admin/staff/${s.id}/invite`, adminTg, { body: { relink: true } });
  assert.equal(r.status, 200);
  assert.equal((await call('GET', '/api/curator/groups', s.tg)).status, 403);
  const newTg = ++nextTg;
  const me = await call('GET', '/api/me', newTg, { startParam: r.body.invite.token });
  assert.equal(me.body.join.status, 'joined');
  assert.equal((await call('GET', '/api/curator/groups', newTg)).status, 200);
});

test('уволен: кабинет закрыт, ссылки отозваны; вернуть — вход по новой ссылке', opts, async () => {
  const s = await hire({ full_name: 'Уволенный Сотрудник', assignments: [{ group_id: groupA, role: 'curator' }] });
  const d = await call('POST', `/api/admin/staff/${s.id}/disable`, adminTg);
  assert.equal(d.status, 200);
  assert.equal(d.body.staff.disabled, true);
  assert.equal(d.body.staff.linked, false);
  assert.equal((await call('GET', '/api/curator/groups', s.tg)).status, 403);
  assert.equal((await call('POST', `/api/admin/staff/${s.id}/invite`, adminTg)).status, 409);
  // запись осталась — история (кто отмечал согласия) не теряется
  const [row] = await db()<{ n: number }[]>`select count(*)::int as n from users where id = ${s.id}`;
  assert.equal(row.n, 1);

  assert.equal((await call('POST', `/api/admin/staff/${s.id}/enable`, adminTg)).status, 200);
  const r = await call('POST', `/api/admin/staff/${s.id}/invite`, adminTg);
  assert.equal(r.status, 200);
  const me = await call('GET', '/api/me', ++nextTg, { startParam: r.body.invite.token });
  assert.equal(me.body.join.status, 'joined');
});

// «Последний администратор» на уровне базы — в staff-schema.db.test.ts: здесь в общей базе есть
// администраторы из других тестов
test('себя не отключить и не отвязать; второй администратор отключает и возвращает первого', opts, async () => {
  assert.equal((await call('POST', `/api/admin/staff/${adminId}/disable`, adminTg)).status, 400);
  assert.equal((await call('POST', `/api/admin/staff/${adminId}/invite`, adminTg, { body: { relink: true } })).status, 400);

  const second = await hire({ full_name: 'Второй Администратор', admin: true });
  const before = (await call('GET', '/api/admin/staff', second.tg)).body.admins_active;
  assert.equal((await call('POST', `/api/admin/staff/${adminId}/disable`, second.tg)).status, 200);
  assert.equal((await call('GET', '/api/admin/staff', second.tg)).body.admins_active, before - 1);
  assert.equal((await call('GET', '/api/admin/staff', adminTg)).status, 403);
  // вернуть первого с новой ссылкой — остальные тесты идут от его имени
  assert.equal((await call('POST', `/api/admin/staff/${adminId}/enable`, second.tg)).status, 200);
  const relinked = await call('POST', `/api/admin/staff/${adminId}/invite`, second.tg);
  adminTg = ++nextTg;
  assert.equal((await call('GET', '/api/me', adminTg, { startParam: relinked.body.invite.token })).body.join.status, 'joined');
  assert.equal((await call('GET', '/api/admin/staff', adminTg)).status, 200);
});

test('неверные данные: ФИО, роль в группе, чужой id — понятные ответы', opts, async () => {
  assert.equal((await call('POST', '/api/admin/staff', adminTg, { body: { full_name: 'Х' } })).status, 400);
  assert.equal(
    (await call('POST', '/api/admin/staff', adminTg, {
      body: { full_name: 'Кто То', assignments: [{ group_id: groupA, role: 'director' }] },
    })).status,
    400,
  );
  assert.equal((await call('PATCH', '/api/admin/staff/not-a-uuid', adminTg, { body: { admin: true } })).status, 404);
  const sid = await student(groupA);
  assert.equal((await call('PATCH', `/api/admin/staff/${sid}`, adminTg, { body: { full_name: 'Не Сотрудник' } })).status, 404);
  assert.equal((await call('POST', `/api/admin/staff/${sid}/invite`, adminTg)).status, 404);
});
