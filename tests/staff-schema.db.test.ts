// Схема 007 (ссылки сотрудников, роли, основа этапа А, #63) на настоящем Postgres с миграциями 001–007.
// Запускается, только если задан TEST_DATABASE_URL (в CI — чистая база в контейнере).
// Никогда не указывайте здесь рабочую базу: тест создаёт свои группы и пользователей.
// Проверяем ограничения самой базы; вход сотрудника и права в api/ — тесты к следующему PR.

import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { closeDb, db } from '../api/_lib/db';

const url = process.env.TEST_DATABASE_URL;
const opts = { skip: url ? false : 'нет TEST_DATABASE_URL' };
let groupId = '';
let teacherId = '';
let n = 0;

before(async () => {
  if (!url) return;
  process.env.DATABASE_URL = url;
  [{ id: groupId }] = await db()<{ id: string }[]>`insert into groups (title) values ('ИС-21 сотрудники') returning id`;
  teacherId = await person('teacher');
});

after(async () => {
  if (url) await closeDb();
});

async function person(role: 'student' | 'teacher' | 'admin'): Promise<string> {
  const [{ id }] = await db()<{ id: string }[]>`
    insert into users (full_name, full_name_source, birth_year, role)
    values ('Сотрудник Тестовый', 'roster', 1985, ${role}) returning id`;
  return id;
}

function rejectsWith(p: Promise<unknown>, code: string, constraint: string) {
  return assert.rejects(p, (e: { code?: string; constraint_name?: string }) => {
    assert.equal(e.code, code);
    assert.equal(e.constraint_name, constraint);
    return true;
  });
}

function token(): string {
  return `s_test${Date.now()}x${++n}`;
}

async function topic(o: { status?: string; approvedBy?: string | null } = {}): Promise<string> {
  const approvedAt = o.approvedBy ? new Date() : null;
  const [{ id }] = await db()<{ id: string }[]>`
    insert into topics (subject_id, title, source, status, author_id, approved_by, approved_at)
    values ('python', 'Переменные', 'editor', ${o.status ?? 'draft'}, ${teacherId}, ${o.approvedBy ?? null}, ${approvedAt})
    returning id`;
  return id;
}

// ── Ссылки сотрудников ───────────────────────────────────────

// Срок считаем от часов приложения, created_at — от часов базы: «47 ч» с запасом укладывается в 48 ч
function staffInvite(userId: string, o: { group?: string | null; hours?: number | null } = {}) {
  const hours = o.hours === undefined ? 47 : o.hours;
  const expiresAt = hours === null ? null : new Date(Date.now() + hours * 3_600_000);
  return db()`
    insert into invites (token, group_id, role, user_id, expires_at)
    values (${token()}, ${o.group ?? null}, 'staff', ${userId}, ${expiresAt})`;
}

test('ссылка сотрудника: без группы, срок до 48 ч', opts, async () => {
  const id = await person('teacher');
  await staffInvite(id);
  const [row] = await db()<{ group_id: string | null; role: string }[]>`
    select group_id, role from invites where user_id = ${id}`;
  assert.deepEqual(row, { group_id: null, role: 'staff' });
});

test('ссылка сотрудника — без группы; ссылка студента — только с группой', opts, async () => {
  await rejectsWith(staffInvite(await person('teacher'), { group: groupId }), '23514', 'invites_staff_no_group');
  await rejectsWith(
    db()`insert into invites (token, role, user_id) values (${token()}, 'student', ${await person('student')})`,
    '23514', 'invites_group_required');
});

test('ссылка сотрудника — всегда со сроком и не дольше 48 ч', opts, async () => {
  await rejectsWith(staffInvite(await person('teacher'), { hours: 72 }), '23514', 'invites_staff_48h');
  await rejectsWith(staffInvite(await person('teacher'), { hours: null }), '23514', 'invites_teacher_expires');
});

test('ссылку сотрудника нельзя выдать студенту', opts, async () => {
  await rejectsWith(staffInvite(await person('student')), '23514', 'invites_staff_not_student');
});

test('у сотрудника одна действующая ссылка', opts, async () => {
  const id = await person('teacher');
  await staffInvite(id);
  await rejectsWith(staffInvite(id), '23505', 'invites_one_active');
});

test('уволенного сотрудника не удаляем — ставим disabled_at', opts, async () => {
  const id = await person('teacher');
  await db()`update users set disabled_at = now(), telegram_user_id = null where id = ${id}`;
  const [row] = await db()<{ disabled: boolean }[]>`select disabled_at is not null as disabled from users where id = ${id}`;
  assert.equal(row.disabled, true);
});

// ── Роли и назначения ────────────────────────────────────────

test('педагог в группе — всегда с предметом, куратор — без', opts, async () => {
  const id = await person('teacher');
  await rejectsWith(
    db()`insert into staff_assignments (user_id, group_id, role) values (${id}, ${groupId}, 'teacher')`,
    '23514', 'staff_assignments_subject');
  await rejectsWith(
    db()`insert into staff_assignments (user_id, group_id, role, subject_id) values (${id}, ${groupId}, 'curator', 'python')`,
    '23514', 'staff_assignments_subject');
});

test('несколько ролей у одного человека; повтор назначения — дубль', opts, async () => {
  const id = await person('teacher');
  const sql = db();
  await sql`insert into staff_assignments (user_id, group_id, role) values (${id}, ${groupId}, 'curator')`;
  await sql`insert into staff_assignments (user_id, group_id, role, subject_id) values (${id}, ${groupId}, 'teacher', 'python')`;
  await sql`insert into staff_assignments (user_id, group_id, role, subject_id) values (${id}, ${groupId}, 'teacher', 'math')`;
  await sql`insert into staff_roles (user_id, role) values (${id}, 'methodist')`;
  await rejectsWith(
    sql`insert into staff_assignments (user_id, group_id, role) values (${id}, ${groupId}, 'curator')`,
    '23505', 'staff_assignments_unique');
  await rejectsWith(
    sql`insert into staff_assignments (user_id, group_id, role, subject_id) values (${id}, ${groupId}, 'teacher', 'python')`,
    '23505', 'staff_assignments_unique');
});

test('роль на колледж — только известная', opts, async () => {
  await rejectsWith(
    db()`insert into staff_roles (user_id, role) values (${await person('admin')}, 'director')`,
    '23514', 'staff_roles_role');
});

// ── Темы и термины ───────────────────────────────────────────

test('утверждённая тема — всегда с тем, кто утвердил', opts, async () => {
  await rejectsWith(topic({ status: 'approved' }), '23514', 'topics_approved');
  await topic({ status: 'approved', approvedBy: teacherId });
});

test('тема из файла — со slug, из редактора — с автором', opts, async () => {
  await rejectsWith(
    db()`insert into topics (subject_id, title, source) values ('python', 'Без файла', 'file')`,
    '23514', 'topics_file_slug');
  await rejectsWith(
    db()`insert into topics (subject_id, title, source) values ('python', 'Без автора', 'editor')`,
    '23514', 'topics_editor_author');
});

test('термин в теме один раз, без учёта регистра', opts, async () => {
  const t = await topic();
  await db()`insert into topic_terms (topic_id, term, definition) values (${t}, 'Переменная', 'имя для значения')`;
  await rejectsWith(
    db()`insert into topic_terms (topic_id, term, definition) values (${t}, 'переменная', 'ещё раз')`,
    '23505', 'topic_terms_unique');
});

// ── Журнал и задания ─────────────────────────────────────────

test('событие журнала: тема или урок обязательны, уверенность 0–1', opts, async () => {
  const student = await person('student');
  const t = await topic();
  const [{ id: term }] = await db()<{ id: string }[]>`
    insert into topic_terms (topic_id, term, definition) values (${t}, 'Тип', 'вид значения') returning id`;
  await db()`
    insert into learning_events (user_id, topic_id, term_id, kind, confidence, source)
    values (${student}, ${t}, ${term}, 'term_stumble', 0.8, 'ai')`;
  await rejectsWith(
    db()`insert into learning_events (user_id, kind, source) values (${student}, 'step_stuck', 'script')`,
    '23514', 'learning_events_target');
  await rejectsWith(
    db()`insert into learning_events (user_id, topic_id, kind, confidence, source)
         values (${student}, ${t}, 'term_stumble', 1.5, 'ai')`,
    '23514', 'learning_events_confidence');
});

test('задание группе — ровно тема или урок', opts, async () => {
  const t = await topic({ status: 'approved', approvedBy: teacherId });
  await db()`insert into group_tasks (group_id, topic_id, assigned_by, due_at)
             values (${groupId}, ${t}, ${teacherId}, now() + interval '7 days')`;
  await rejectsWith(
    db()`insert into group_tasks (group_id, assigned_by) values (${groupId}, ${teacherId})`,
    '23514', 'group_tasks_target');
});

// ── Безопасность ─────────────────────────────────────────────

test('RLS включён на всех новых таблицах', opts, async () => {
  const rows = await db()<{ relname: string; relrowsecurity: boolean }[]>`
    select relname, relrowsecurity from pg_class
     where relnamespace = 'public'::regnamespace and relname in
       ('staff_roles','staff_assignments','topics','topic_terms','learning_events','group_tasks')`;
  assert.equal(rows.length, 6);
  for (const r of rows) assert.equal(r.relrowsecurity, true, r.relname);
});
