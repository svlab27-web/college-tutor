// Сотрудники колледжа и их права (#63, миграция 007).
//
// Сотрудник = users.role 'teacher' или 'admin' с привязанным Telegram и без disabled_at.
// Права — только из staff_roles (на весь колледж) и staff_assignments (в группе);
// users.role = 'admin' и group_members.role = 'teacher' для прав больше не читаем (007 их перенесла).
//
//   admin (колледж)   — сотрудники и группы (/api/admin/*); каждая группа — как у куратора
//   methodist (колледж) — все группы на чтение
//   curator (группа)  — список, ссылки, согласия родителей, ФИО, обращения
//   teacher (группа, предмет) — прогресс и обращения своей группы на чтение, отметка «решено»
//
// Чужая и несуществующая группа — один ответ 404: не подсказываем, какие группы есть.

import type postgres from 'postgres';
import { HttpError } from './http';
import { findUser, type UserRow } from './users';

type Sql = postgres.Sql | postgres.TransactionSql;

export const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// read   — смотреть: прогресс, обращения
// answer — read + отметить обращение «решено»
// manage — всё по студентам группы: завести, ссылки, ФИО, согласие родителя, отвязать
export type GroupAccess = 'read' | 'answer' | 'manage';

export interface Staff extends UserRow {
  admin: boolean;
  methodist: boolean;
}

export interface StaffGroup {
  id: string;
  title: string;
  language: string;
  curator: boolean;
  subjects: string[]; // где он педагог
}

export async function findStaff(sql: Sql, telegramUserId: number): Promise<Staff | undefined> {
  const user = await findUser(sql, telegramUserId);
  if (!user || (user.role !== 'teacher' && user.role !== 'admin')) return undefined;
  const roles = await sql<{ role: string }[]>`select role from staff_roles where user_id = ${user.id}`;
  return {
    ...user,
    admin: roles.some((r) => r.role === 'admin'),
    methodist: roles.some((r) => r.role === 'methodist'),
  };
}

export async function requireStaff(sql: Sql, telegramUserId: number): Promise<Staff> {
  const staff = await findStaff(sql, telegramUserId);
  if (!staff) throw new HttpError(403, 'staff_only', 'Кабинет доступен сотрудникам колледжа.');
  return staff;
}

export async function requireAdmin(sql: Sql, telegramUserId: number): Promise<Staff> {
  const staff = await requireStaff(sql, telegramUserId);
  if (!staff.admin) throw new HttpError(403, 'admin_only', 'Это может только администратор колледжа.');
  return staff;
}

// Группы, которые сотрудник видит в кабинете, и его роли в каждой.
// Администратор и методист видят все группы колледжа.
export async function staffGroups(sql: Sql, staff: Staff): Promise<StaffGroup[]> {
  const all = staff.admin || staff.methodist;
  return sql<StaffGroup[]>`
    select g.id, g.title, g.language,
           coalesce(bool_or(a.role = 'curator'), false) as curator,
           coalesce(array_agg(a.subject_id order by a.subject_id) filter (where a.role = 'teacher'), '{}') as subjects
      from groups g
      left join staff_assignments a on a.group_id = g.id and a.user_id = ${staff.id}
     group by g.id
    having ${all} or count(a.id) > 0
     order by g.title`;
}

// Есть ли у сотрудника такой доступ к группе (SQL-условие для подзапросов по group_id)
function accessCondition(sql: Sql, staff: Staff, groupId: postgres.Fragment | string, level: GroupAccess) {
  const roles = level === 'manage' ? ['curator'] : ['curator', 'teacher'];
  const collegeWide = staff.admin || (level === 'read' && staff.methodist);
  return sql`(${collegeWide} or exists (
    select 1 from staff_assignments a
     where a.group_id = ${groupId} and a.user_id = ${staff.id} and a.role in ${sql(roles)}))`;
}

export async function requireGroup(sql: Sql, staff: Staff, groupId: unknown, level: GroupAccess): Promise<string> {
  if (typeof groupId !== 'string' || !UUID.test(groupId)) {
    throw new HttpError(400, 'bad_group', 'Не указана группа.');
  }
  const [row] = await sql<{ ok: boolean }[]>`
    select exists (select 1 from groups g where g.id = ${groupId} and ${accessCondition(sql, staff, groupId, level)}) as ok`;
  if (!row.ok) throw new HttpError(404, 'group_not_found', 'Группа не найдена.');
  return groupId;
}

// Студент группы, где у сотрудника есть доступ level → id этой группы. Иначе 404.
export async function requireStudent(
  sql: Sql,
  staff: Staff,
  studentId: string,
  level: GroupAccess = 'manage',
): Promise<{ groupId: string }> {
  const [row] = await sql<{ group_id: string }[]>`
    select m.group_id
      from group_members m
      join users u on u.id = m.user_id and u.role = 'student'
     where m.user_id = ${studentId} and m.role = 'student'
       and ${accessCondition(sql, staff, sql`m.group_id`, level)}
     order by m.joined_at
     limit 1`;
  if (!row) throw new HttpError(404, 'student_not_found', 'Студент не найден в ваших группах.');
  return { groupId: row.group_id };
}

// Для отметки обращения: у сотрудника есть доступ level к группе обращения
export function groupAccessSql(sql: Sql, staff: Staff, groupColumn: postgres.Fragment, level: GroupAccess) {
  return accessCondition(sql, staff, groupColumn, level);
}
