// SQL «первый администратор / восстановить доступ» (scripts/staff-sql.ts) на настоящем Postgres:
// по ссылке из скрипта человек входит и попадает в кабинет администратора.
// Запускается, только если задан TEST_DATABASE_URL (в CI — чистая база в контейнере).

import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { signInitData } from '../api/_lib/auth';
import { newInviteToken } from '../api/_lib/curator';
import { closeDb, db } from '../api/_lib/db';
import { route } from '../api/_lib/router';
import { adminSql, recoverSql } from '../scripts/staff-sql';

const url = process.env.TEST_DATABASE_URL;
const BOT_TOKEN = '123456789:TEST_ONLY_not_a_real_token';
const opts = { skip: url ? false : 'нет TEST_DATABASE_URL' };
let nextTg = Math.floor(Date.now() / 1000) * 1000 + 900_000;

before(() => {
  if (!url) return;
  process.env.DATABASE_URL = url;
  process.env.BOT_TOKEN = BOT_TOKEN;
});
after(async () => {
  if (url) await closeDb();
});

// Скрипт целиком, как в SQL Editor: begin … commit на одном соединении
async function runScript(text: string) {
  const conn = await db().reserve();
  try {
    await conn.unsafe(text);
  } catch (e) {
    // как SQL Editor после ошибки: незавершённую транзакцию откатываем, соединение — обратно чистым
    await conn.unsafe('rollback');
    throw e;
  } finally {
    conn.release();
  }
}

async function call(method: string, path: string, tg: number, startParam?: string) {
  const fields: Record<string, string> = {
    auth_date: String(Math.floor(Date.now() / 1000)),
    user: JSON.stringify({ id: tg, first_name: 'Тест', language_code: 'ru' }),
  };
  if (startParam) fields.start_param = startParam;
  const res = await route(
    new Request(`http://localhost${path}`, {
      method,
      headers: { 'x-telegram-init-data': new URLSearchParams({ ...fields, hash: signInitData(fields, BOT_TOKEN) }).toString() },
    }),
  );
  return { status: res.status, body: (await res.json()) as any };
}

const uniqueName = () => `Админов${String(++nextTg).replace(/\d/g, (d) => 'абвгдежзик'[Number(d)])} Пётр`;

test('новый администратор: SQL → вход по ссылке → кабинет администратора', opts, async () => {
  const name = uniqueName();
  const token = newInviteToken();
  await runScript(adminSql(name, token));
  const tg = ++nextTg;
  const me = await call('GET', '/api/me', tg, token);
  assert.deepEqual(me.body.join, { status: 'joined', staff: true });
  assert.equal(me.body.staff.admin, true);
  assert.equal((await call('GET', '/api/admin/staff', tg)).status, 200);
});

test('восстановить доступ: прежний Telegram отвязан, отключённый возвращён, новая ссылка работает', opts, async () => {
  const name = uniqueName();
  const first = newInviteToken();
  await runScript(adminSql(name, first));
  const oldTg = ++nextTg;
  await call('GET', '/api/me', oldTg, first);
  // второй администратор нужен, чтобы этого можно было отключить
  const helper = newInviteToken();
  await runScript(adminSql(uniqueName(), helper));
  await db()`update users set disabled_at = now() where lower(full_name) = lower(${name})`;

  const token = newInviteToken();
  await runScript(recoverSql(name.toUpperCase(), token));
  assert.equal((await call('GET', '/api/admin/staff', oldTg)).status, 403);
  const newTg = ++nextTg;
  assert.equal((await call('GET', '/api/me', newTg, token)).body.join.status, 'joined');
  assert.equal((await call('GET', '/api/admin/staff', newTg)).status, 200);
});

test('восстановить: ФИО не найдено или не одно — ошибка, ничего не меняется', opts, async () => {
  await assert.rejects(runScript(recoverSql('Несуществующий Сотрудник', newInviteToken())), /нужен ровно один/);
  const name = uniqueName();
  await runScript(adminSql(name, newInviteToken()));
  await runScript(adminSql(name, newInviteToken()));
  await assert.rejects(runScript(recoverSql(name, newInviteToken())), /нужен ровно один/);
});

test('ФИО с кавычкой не ломает SQL; мусор вместо ФИО — отказ до SQL', opts, async () => {
  const token = newInviteToken();
  await runScript(adminSql(`О'Нил ${uniqueName()}`, token));
  const [row] = await db()<{ n: number }[]>`select count(*)::int as n from invites where token = ${token}`;
  assert.equal(row.n, 1);
  assert.throws(() => adminSql("x'); drop table users; --", newInviteToken()), /ФИО/);
});
