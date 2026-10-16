// SQL для Supabase SQL Editor (scripts/lessons-sql.ts) на настоящем Postgres: даёт то же, что syncLessons,
// а проверочный запрос ловит испорченный урок. Запускается, только если задан TEST_DATABASE_URL.

import assert from 'node:assert/strict';
import { resolve } from 'node:path';
import { after, before, test } from 'node:test';
import { closeDb, db } from '../api/_lib/db';
import { loadContent } from '../scripts/lessons';
import { syncSql, verifySql } from '../scripts/lessons-sql';
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

// Скрипт целиком, как в SQL Editor: begin … commit на одном соединении
async function runScript(text: string) {
  const conn = await db().reserve();
  try {
    await conn.unsafe(text);
  } finally {
    conn.release();
  }
}

test('SQL Editor: загрузка = lessons:sync, повтор безопасен, проверка «всё совпадает»', opts, async () => {
  const sql = db();
  await runScript(syncSql(CONTENT));
  await runScript(syncSql(CONTENT)); // повторный запуск
  const { lessons } = loadContent(CONTENT);
  const again = await syncLessons(sql, lessons);
  assert.equal(again.inserted.length + again.updated.length, 0, 'после SQL синхронизации менять нечего');
  const [{ итог }] = await sql.unsafe(verifySql(CONTENT));
  const n = lessons.length + lessons.reduce((k, l) => k + l.translations.length, 0);
  assert.equal(итог, `всё совпадает: ${n} из ${n}`);
});

test('SQL Editor: проверка называет испорченный урок (кракозябры, снятая публикация)', opts, async () => {
  const sql = db();
  await runScript(syncSql(CONTENT));
  await sql
    .begin(async (tx) => {
      await tx`update lessons set content = jsonb_set(content, '{title}', '"–Т–Л"') where slug = '01-skidka-v-kafe' and version = 1`;
      const [{ итог }] = await tx.unsafe(verifySql(CONTENT));
      assert.equal(итог, 'НЕ совпадает: урок python/01-skidka-v-kafe');
      throw new Error('rollback');
    })
    .catch((e: Error) => {
      if (e.message !== 'rollback') throw e;
    });
});
