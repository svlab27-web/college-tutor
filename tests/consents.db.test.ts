// Согласие родителя на настоящем Postgres с миграциями 001–006.
// Запускается, только если задан TEST_DATABASE_URL (в CI — чистая база в контейнере).
// Никогда не указывайте здесь рабочую базу: тест создаёт своих пользователей.

import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { closeDb, db } from '../api/_lib/db';
import { CONSENT_DOC_VERSION } from '../api/_lib/profile';

const url = process.env.TEST_DATABASE_URL;
const opts = { skip: url ? false : 'нет TEST_DATABASE_URL' };
let curatorId = '';

before(async () => {
  if (!url) return;
  process.env.DATABASE_URL = url;
  [{ id: curatorId }] = await db()<{ id: string }[]>`
    insert into users (full_name, full_name_source, birth_year, role)
    values ('Куратор Согласий', 'roster', 1985, 'teacher') returning id`;
});

after(async () => {
  if (url) await closeDb();
});

async function minorStudent(): Promise<string> {
  const [{ id }] = await db()<{ id: string }[]>`
    insert into users (full_name, full_name_source, birth_year, birth_date, role)
    values ('Студент Младше', 'roster', 2010, '2010-05-01', 'student') returning id`;
  return id;
}

function markParental(studentId: string) {
  return db()`
    insert into consents (user_id, kind, doc_version, granted_via, parent_name, document_ref, recorded_by)
    values (${studentId}, 'parental', ${CONSENT_DOC_VERSION}, 'paper', 'Родитель Тест', 'личное дело № 1', ${curatorId})`;
}

test('второе действующее согласие родителя — 23505 (consents_one_parental)', opts, async () => {
  const id = await minorStudent();
  await markParental(id);
  await assert.rejects(markParental(id), (e: { code?: string; constraint_name?: string }) => {
    assert.equal(e.code, '23505');
    assert.equal(e.constraint_name, 'consents_one_parental');
    return true;
  });
});

test('после снятия отметки (revoked_at) можно отметить заново', opts, async () => {
  const id = await minorStudent();
  await markParental(id);
  await db()`update consents set revoked_at = now() where user_id = ${id} and kind = 'parental'`;
  await markParental(id);
  const [{ active, total }] = await db()<{ active: number; total: number }[]>`
    select count(*) filter (where revoked_at is null)::int as active, count(*)::int as total
      from consents where user_id = ${id} and kind = 'parental'`;
  assert.equal(active, 1);
  assert.equal(total, 2);
});
