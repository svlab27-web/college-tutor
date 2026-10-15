// Кабинет куратора (#9): кто может работать с группой и студентом, личные ссылки.
// Решение 14.10.2026 (docs/decisions.md): студентов заводит куратор, у каждого — своя
// одноразовая ссылка, согласие родителя отмечает куратор по документам колледжа.
//
// Доступ: преподаватель (users.role = 'teacher') — только к группам, где он
// group_members.role = 'teacher'; администратор колледжа (users.role = 'admin') — ко всем.
// Личность — только из проверенного initData (session.ts), telegram_user_id наружу не отдаём.

import { randomInt } from 'node:crypto';
import type postgres from 'postgres';
import { HttpError } from './http';
import { findUser, type UserRow } from './users';

type Sql = postgres.Sql | postgres.TransactionSql;

export const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Личная ссылка студента: startapp=i_<16 символов>. Без похожих символов (0/O, 1/l/I),
// чтобы код можно было продиктовать; 16 знаков из 56 — около 93 бит, не подобрать.
// Формат проходит invites_token_format (004): ^[A-Za-z0-9_-]{16,64}$
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';
export const STUDENT_INVITE_DAYS = 30;

export function newInviteToken(): string {
  let code = '';
  for (let i = 0; i < 16; i++) code += ALPHABET[randomInt(ALPHABET.length)];
  return `i_${code}`;
}

export async function requireStaff(sql: Sql, telegramUserId: number): Promise<UserRow> {
  const user = await findUser(sql, telegramUserId);
  if (!user || (user.role !== 'teacher' && user.role !== 'admin')) {
    throw new HttpError(403, 'staff_only', 'Кабинет доступен преподавателям и кураторам колледжа.');
  }
  return user;
}

export async function requireGroup(sql: Sql, staff: UserRow, groupId: unknown): Promise<string> {
  if (typeof groupId !== 'string' || !UUID.test(groupId)) {
    throw new HttpError(400, 'bad_group', 'Не указана группа.');
  }
  const [row] = await sql<{ ok: boolean }[]>`
    select exists (
      select 1 from groups g
       where g.id = ${groupId}
         and (${staff.role === 'admin'} or exists (
               select 1 from group_members m
                where m.group_id = g.id and m.user_id = ${staff.id} and m.role = 'teacher'))
    ) as ok`;
  // Чужая и несуществующая группа — один ответ: не подсказываем, какие группы есть
  if (!row.ok) throw new HttpError(404, 'group_not_found', 'Группа не найдена.');
  return groupId;
}

// Студент моей группы → id его группы (для ссылки). Иначе 404.
export async function requireStudent(sql: Sql, staff: UserRow, studentId: string): Promise<{ groupId: string }> {
  const [row] = await sql<{ group_id: string }[]>`
    select m.group_id
      from group_members m
      join users u on u.id = m.user_id and u.role = 'student'
     where m.user_id = ${studentId} and m.role = 'student'
       and (${staff.role === 'admin'} or exists (
             select 1 from group_members t
              where t.group_id = m.group_id and t.user_id = ${staff.id} and t.role = 'teacher'))
     order by m.joined_at
     limit 1`;
  if (!row) throw new HttpError(404, 'student_not_found', 'Студент не найден в ваших группах.');
  return { groupId: row.group_id };
}

// Новая личная ссылка: прежняя действующая отзывается (у студента одна — invites_one_active)
export async function issueInvite(
  tx: postgres.TransactionSql,
  studentId: string,
  groupId: string,
  createdBy: string,
): Promise<{ token: string; expires_at: string }> {
  await tx`
    update invites set revoked_at = now()
     where user_id = ${studentId} and used_at is null and revoked_at is null`;
  const token = newInviteToken();
  const [row] = await tx<{ expires_at: string }[]>`
    insert into invites (token, group_id, role, user_id, expires_at, created_by)
    values (${token}, ${groupId}, 'student', ${studentId},
            now() + make_interval(days => ${STUDENT_INVITE_DAYS}), ${createdBy})
    returning expires_at`;
  return { token, expires_at: new Date(row.expires_at).toISOString() };
}

// Проверка ФИО и даты от куратора. Возвращает только заданные поля.
export interface RosterFields {
  full_name?: string;
  birth_date?: string | null;
  birth_year?: number;
}

const NAME = /^[\p{L}][\p{L}\p{M}' .-]{1,118}[\p{L}.]$/u;

export function rosterFields(body: Record<string, unknown>, required: boolean): RosterFields {
  const out: RosterFields = {};
  if ('full_name' in body || required) {
    const name = typeof body.full_name === 'string' ? body.full_name.trim().replace(/\s+/g, ' ') : '';
    if (!NAME.test(name) || !name.includes(' ')) {
      throw new HttpError(400, 'bad_name', 'ФИО: фамилия и имя буквами, до 120 символов.');
    }
    out.full_name = name;
  }
  if ('birth_date' in body && body.birth_date !== null && body.birth_date !== '') {
    const d = typeof body.birth_date === 'string' ? body.birth_date : '';
    const parsed = /^\d{4}-\d{2}-\d{2}$/.test(d) ? new Date(`${d}T00:00:00Z`) : null;
    if (!parsed || isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== d || d < '1950-01-01' || d > '2020-12-31') {
      throw new HttpError(400, 'bad_birth_date', 'Дата рождения: ГГГГ-ММ-ДД, с 1950 по 2020 год.');
    }
    out.birth_date = d;
    out.birth_year = Number(d.slice(0, 4));
  } else if ('birth_year' in body) {
    const y = Number(body.birth_year);
    if (!Number.isInteger(y) || y < 1950 || y > 2020) {
      throw new HttpError(400, 'bad_birth_year', 'Год рождения: с 1950 по 2020.');
    }
    out.birth_year = y;
    out.birth_date = null;
  }
  if (required && out.birth_year === undefined) {
    throw new HttpError(400, 'birth_required', 'Укажите дату рождения (или хотя бы год) — от неё зависит согласие родителя.');
  }
  return out;
}
