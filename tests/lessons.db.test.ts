// Синхронизация уроков на настоящем Postgres с миграциями 001–005.
// Запускается, только если задан TEST_DATABASE_URL (в CI — чистая база в контейнере).

import assert from 'node:assert/strict';
import { resolve } from 'node:path';
import { after, before, test } from 'node:test';
import { closeDb, db } from '../api/_lib/db';
import { loadContent, type Obj } from '../scripts/lessons';
import { syncLessons } from '../scripts/sync-lessons';

const url = process.env.TEST_DATABASE_URL;
const opts = { skip: url ? false : 'нет TEST_DATABASE_URL' };
const CONTENT = resolve(__dirname, '..', '..', 'content');

before(() => {
  if (url) process.env.DATABASE_URL = url;
});
after(async () => {
  if (url) await closeDb();
});

test('уроки и переводы попадают в базу; повторный запуск ничего не меняет', opts, async () => {
  const sql = db();
  const { lessons, errors } = loadContent(CONTENT);
  assert.deepEqual(errors, []);
  await syncLessons(sql, lessons);
  const again = await syncLessons(sql, lessons);
  assert.equal(again.inserted.length + again.updated.length, 0);
  assert.equal(again.unchanged.length, lessons.length);

  const rows = await sql<{ slug: string; is_published: boolean; language: string; steps: number; tr: string | null }[]>`
    select l.slug, l.is_published, l.language, jsonb_array_length(l.content->'steps') as steps, t.status as tr
      from lessons l left join lesson_translations t on t.lesson_id = l.id and t.language = 'kk'
     where l.slug in ('01-skidka-v-kafe', '01-dvor-maks-ploshchadi') order by l.slug`;
  assert.equal(rows.length, 2);
  for (const r of rows) {
    assert.equal(r.language, 'ru');
    // опубликован ровно тогда, когда в файле status approved (утвердил преподаватель)
    const file = lessons.find((l) => l.base.slug === r.slug)!;
    assert.equal(r.is_published, file.base.content.status === 'approved', r.slug);
    assert.equal(r.tr, file.translations[0].content.status, r.slug);
    assert.ok(r.steps >= 4);
  }
});

test('изменение урока обновляет ту же запись (id не меняется — прогресс сохраняется); approved публикует', opts, async () => {
  const sql = db();
  const { lessons } = loadContent(CONTENT);
  await syncLessons(sql, lessons);
  const python = lessons.find((l) => l.base.slug === '01-skidka-v-kafe')!;
  const [{ id: before }] = await sql<{ id: string }[]>`select id from lessons where slug = '01-skidka-v-kafe'`;

  const changed = structuredClone(python);
  (changed.base.content as Obj).status = 'approved';
  (changed.base.content as Obj).approved_by = 'Иванова А. С.';
  (changed.translations[0].content as Obj).status = 'approved';
  const r = await syncLessons(sql, [changed]);
  assert.deepEqual(r.updated, ['python/01-skidka-v-kafe']);

  const [row] = await sql<{ id: string; is_published: boolean; approved_by: string; tr: string; approved_at: Date | null }[]>`
    select l.id, l.is_published, l.approved_by, t.status as tr, t.approved_at
      from lessons l join lesson_translations t on t.lesson_id = l.id where l.slug = '01-skidka-v-kafe'`;
  assert.equal(row.id, before);
  assert.equal(row.is_published, true);
  assert.equal(row.approved_by, 'Иванова А. С.');
  assert.equal(row.tr, 'approved');
  assert.ok(row.approved_at);

  await syncLessons(sql, lessons); // вернуть как в файлах
});
