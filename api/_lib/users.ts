// Студенты и преподаватели в базе. Каждый запрос — только по user.id из проверенного initData.
// telegram_user_id (bigint) наружу не отдаём и не читаем: postgres.js вернул бы строку.

import type postgres from 'postgres';
import { HttpError } from './http';

type Sql = postgres.Sql | postgres.TransactionSql;

export interface UserRow {
  id: string;
  role: 'student' | 'teacher' | 'admin';
  full_name: string | null;
  full_name_source: 'self' | 'roster' | null;
  birth_year: number | null;
  birth_date: string | null; // YYYY-MM-DD (004), наружу не отдаём
  ui_language: 'ru' | 'kk' | null;
}

export interface GroupRow {
  id: string;
  title: string;
  language: string;
  role: 'student' | 'teacher';
}

// Студентов заводит куратор (004): по Telegram находим только тех, кто вошёл по личной ссылке.
// Незнакомый Telegram в базу не пишем — он работает в демо.
// Отключённый сотрудник (007, disabled_at) — как незнакомый: при отключении Telegram и так отвязываем.
export async function findUser(sql: Sql, telegramUserId: number): Promise<UserRow | undefined> {
  const [user] = await sql<UserRow[]>`
    select id, role, full_name, full_name_source, birth_year, birth_date::text, ui_language
      from users where telegram_user_id = ${telegramUserId} and disabled_at is null`;
  return user;
}

export async function requireUser(sql: Sql, telegramUserId: number): Promise<UserRow> {
  const user = await findUser(sql, telegramUserId);
  if (!user) {
    throw new HttpError(403, 'not_registered', 'Откройте личную ссылку от куратора — тогда прогресс будет сохраняться.');
  }
  return user;
}

export async function userGroups(sql: Sql, userId: string): Promise<GroupRow[]> {
  return sql<GroupRow[]>`
    select g.id, g.title, g.language, m.role
      from group_members m join groups g on g.id = m.group_id
     where m.user_id = ${userId}
     order by m.joined_at`;
}

export async function consentFlags(
  sql: Sql,
  userId: string,
  docVersion: string,
): Promise<{ hasConsent: boolean; hasParentalConsent: boolean }> {
  const [row] = await sql<{ consent: boolean; parental: boolean }[]>`
    select
      exists (select 1 from consents where user_id = ${userId} and kind = 'personal_data'
                and doc_version = ${docVersion} and revoked_at is null) as consent,
      exists (select 1 from consents where user_id = ${userId} and kind = 'parental'
                and revoked_at is null) as parental`;
  return { hasConsent: row.consent, hasParentalConsent: row.parental };
}
