// Схема 007 (сотрудники, роли, основа этапа А, #63) на настоящем Postgres с миграциями 001–007.
// Запускается, только если задан TEST_DATABASE_URL (в CI — чистая база в контейнере).
// Никогда не указывайте здесь рабочую базу: тест создаёт свои группы и пользователей.
// Проверяем ограничения самой базы; вход и права в api/ — отдельные тесты к следующему PR.

import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { closeDb, db } from '../api/_lib/db';

const url = process.env.TEST_DATABASE_URL;
const opts = { skip: url ? false : 'нет TEST_DATABASE_URL' };
const HASH = 'scrypt$16384$8$1$c29sdA==$aGFzaA=='; // формат, не настоящий пароль
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

function login(): string {
  return `t${Date.now() % 1_000_000}_${++n}`;
}

function rejectsWith(p: Promise<unknown>, code: string, constraint: string) {
  return assert.rejects(p, (e: { code?: string; constraint_name?: string }) => {
    assert.equal(e.code, code);
    assert.equal(e.constraint_name, constraint);
    return true;
  });
}

function account(userId: string, l: string, hash = HASH) {
  return db()`insert into staff_accounts (user_id, login, password_hash) values (${userId}, ${l}, ${hash})`;
}

async function topic(o: { status?: string; approvedBy?: string | null } = {}): Promise<string> {
  const approvedAt = o.approvedBy ? new Date() : null;
  const [{ id }] = await db()<{ id: string }[]>`
    insert into topics (subject_id, title, source, status, author_id, approved_by, approved_at)
    values ('python', 'Переменные', 'editor', ${o.status ?? 'draft'}, ${teacherId}, ${o.approvedBy ?? null}, ${approvedAt})
    returning id`;
  return id;
}

// ── Учётные записи ───────────────────────────────────────────

test('учётная запись: по умолчанию временный пароль, попыток 0', opts, async () => {
  const id = await person('teacher');
  await account(id, login());
  const [row] = await db()<{ must_change_password: boolean; failed_attempts: number; disabled_at: Date | null }[]>`
    select must_change_password, failed_attempts, disabled_at from staff_accounts where user_id = ${id}`;
  assert.deepEqual(row, { must_change_password: true, failed_attempts: 0, disabled_at: null });
});

test('логин уникален', opts, async () => {
  const l = login();
  await account(await person('teacher'), l);
  await rejectsWith(account(await person('teacher'), l), '23505', 'staff_accounts_login');
});

test('логин — только строчные, 3–32 символа', opts, async () => {
  for (const bad of ['Ivanova', 'ab', '-abc', 'иванова', 'a'.repeat(33), 'ab c']) {
    await rejectsWith(account(await person('teacher'), bad), '23514', 'staff_accounts_login_format');
  }
});

test('пароль — только хеш scrypt', opts, async () => {
  await rejectsWith(account(await person('teacher'), login(), 'qwerty123'), '23514', 'staff_accounts_hash_format');
});

test('учётную запись нельзя завести на студента', opts, async () => {
  await rejectsWith(account(await person('student'), login()), '23514', 'staff_accounts_not_student');
});

test('сотрудника с учётной записью нельзя удалить — только disabled_at', opts, async () => {
  const id = await person('teacher');
  await account(id, login());
  await assert.rejects(db()`delete from users where id = ${id}`, (e: { code?: string }) => e.code === '23503');
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
       ('staff_accounts','staff_roles','staff_assignments','topics','topic_terms','learning_events','group_tasks')`;
  assert.equal(rows.length, 7);
  for (const r of rows) assert.equal(r.relrowsecurity, true, r.relname);
});
