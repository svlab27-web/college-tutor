// Доступ к базе — только через этот модуль (решение #33: DATABASE_URL, без supabase-js).
//
// Прототип (Vercel + Supabase): DATABASE_URL = строка Transaction pooler из Supabase → Connect
//   (порт 6543, IPv4). Прямая строка db.<ref>.supabase.co работает только по IPv6 — Vercel её не видит.
// Свой сервер (docker compose): DATABASE_URL = postgres://tutor:…@db:5432/tutor?sslmode=disable
//
// Подключаемся тем же пользователем, что применял миграции: RLS без политик пропускает
// только владельца таблиц. Каждый запрос обязан фильтровать по пользователю (docs/api.md, п. 4).

import postgres from 'postgres';
import { env, requireEnv } from './env';

let sql: postgres.Sql | undefined;

export function dbConfigured(): boolean {
  return env('DATABASE_URL') !== undefined;
}

export function db(): postgres.Sql {
  if (!sql) {
    const url = requireEnv('DATABASE_URL');
    sql = postgres(url, {
      // Transaction pooler Supabase не поддерживает prepared statements
      prepare: false,
      max: Number(env('DB_POOL_MAX') ?? 5),
      idle_timeout: 20,
      connect_timeout: 10,
      // sslmode в строке подключения главнее; без него — только шифрованное соединение
      ...(url.includes('sslmode=') ? {} : { ssl: 'require' as const }),
    });
  }
  return sql;
}

export async function closeDb(): Promise<void> {
  if (sql) {
    await sql.end({ timeout: 5 });
    sql = undefined;
  }
}
