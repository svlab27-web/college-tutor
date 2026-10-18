// Кабинет администратора колледжа (#63): «Сотрудники и группы». Только staff_roles.role = 'admin'.
// Решение 18.10.2026 (Эльвира): колледж после передачи заводит сотрудников и группы сам,
// мы заводим только первых администраторов (scripts/staff-sql.ts).
//
// GET    /api/admin/staff                               — сотрудники: роли, группы, вошёл ли, ссылка, отключён ли
// POST   /api/admin/staff                               — завести { full_name, admin?, methodist?, assignments?: [...] } + ссылка
// PATCH  /api/admin/staff/:id                           — { full_name?, admin?, methodist? }
// POST   /api/admin/staff/:id/assignments               — назначить { group_id, role: 'curator' | 'teacher', subject_id? }
// DELETE /api/admin/staff/:id/assignments/:assignment   — снять назначение
// POST   /api/admin/staff/:id/invite                    — новая ссылка (48 ч); { relink: true } — сменил Telegram: отвязать
// POST   /api/admin/staff/:id/disable                   — уволен: кабинет закрыт, Telegram отвязан, ссылки отозваны
// POST   /api/admin/staff/:id/enable                    — вернуть (войдёт по новой ссылке)
// GET    /api/admin/groups                              — все группы: студентов, кураторы, педагоги
// POST   /api/admin/groups                              — { title, language? }
// PATCH  /api/admin/groups/:id                          — { title?, language? }
//
// Последнего администратора не отключить и не лишить роли (007, staff_keep_admin) → 409 last_admin.
// Администраторов советуем держать двоих: admins_active в ответе, интерфейс предупреждает, если один.

import type postgres from 'postgres';
import { newInviteToken } from '../curator';
import { db } from '../db';
import { HttpError, json } from '../http';
import { readJson, requireIdentity } from '../session';
import { requireAdmin, UUID, type Staff } from '../staff';

export const STAFF_INVITE_HOURS = 48; // invites_staff_48h (007)

const NAME = /^[\p{L}][\p{L}\p{M}' .-]{1,118}[\p{L}.]$/u;
const GROUP_TITLE = /^[\p{L}\p{N}][\p{L}\p{N}\p{M} .,()\/№-]{0,59}$/u;

function idAt(req: Request, index: number, notFound: string): string {
  const id = new URL(req.url).pathname.split('/')[index] ?? '';
  if (!UUID.test(id)) throw new HttpError(404, notFound, 'Не найдено.');
  return id;
}

function staffName(value: unknown): string {
  const name = typeof value === 'string' ? value.trim().replace(/\s+/g, ' ') : '';
  if (!NAME.test(name) || !name.includes(' ')) {
    throw new HttpError(400, 'bad_name', 'ФИО: фамилия и имя буквами, до 120 символов.');
  }
  return name;
}

function flag(body: Record<string, unknown>, key: string): boolean | undefined {
  if (!(key in body)) return undefined;
  if (typeof body[key] !== 'boolean') throw new HttpError(400, `bad_${key}`, `${key}: true или false.`);
  return body[key] as boolean;
}

// Последний администратор (007) и прочие ограничения базы → понятный ответ
function dbError(e: unknown): never {
  const err = e as { code?: string; constraint_name?: string };
  if (err.constraint_name === 'staff_keep_admin') {
    throw new HttpError(409, 'last_admin', 'Это последний администратор колледжа. Сначала назначьте другого.');
  }
  if (err.constraint_name === 'staff_assignments_unique') {
    throw new HttpError(409, 'already_assigned', 'Такое назначение уже есть.');
  }
  if (err.code === '23503' && err.constraint_name?.includes('subject')) {
    throw new HttpError(400, 'bad_subject', 'Нет такого предмета.');
  }
  throw e;
}

async function requireStaffMember(sql: postgres.Sql | postgres.TransactionSql, id: string) {
  const [row] = await sql<{ id: string }[]>`
    select id from users where id = ${id} and role in ('teacher','admin')`;
  if (!row) throw new HttpError(404, 'staff_not_found', 'Сотрудник не найден.');
}

interface Assignment {
  group_id: string;
  role: 'curator' | 'teacher';
  subject_id: string | null;
}

function assignmentOf(raw: unknown): Assignment {
  const a = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  if (typeof a.group_id !== 'string' || !UUID.test(a.group_id)) throw new HttpError(400, 'bad_group', 'Не указана группа.');
  if (a.role !== 'curator' && a.role !== 'teacher') throw new HttpError(400, 'bad_role', 'Роль в группе: curator или teacher.');
  const subject = a.role === 'teacher' ? a.subject_id : null;
  if (a.role === 'teacher' && (typeof subject !== 'string' || !subject)) {
    throw new HttpError(400, 'subject_required', 'Педагогу нужен предмет.');
  }
  return { group_id: a.group_id, role: a.role, subject_id: (subject as string | null) ?? null };
}

async function assign(tx: postgres.TransactionSql, userId: string, a: Assignment, by: string) {
  const [group] = await tx<{ id: string }[]>`select id from groups where id = ${a.group_id}`;
  if (!group) throw new HttpError(404, 'group_not_found', 'Группа не найдена.');
  await tx`
    insert into staff_assignments (user_id, group_id, role, subject_id, created_by)
    values (${userId}, ${a.group_id}, ${a.role}, ${a.subject_id}, ${by})`;
}

async function setCollegeRole(tx: postgres.TransactionSql, userId: string, role: 'admin' | 'methodist', on: boolean | undefined, by: string) {
  if (on === undefined) return;
  if (on) {
    await tx`insert into staff_roles (user_id, role, created_by) values (${userId}, ${role}, ${by}) on conflict do nothing`;
  } else {
    await tx`delete from staff_roles where user_id = ${userId} and role = ${role}`;
  }
}

// Новая ссылка сотрудника: прежние неиспользованные отзываются (одна действующая — invites_one_active)
export async function issueStaffInvite(tx: postgres.TransactionSql, userId: string, by: string | null) {
  await tx`
    update invites set revoked_at = now()
     where user_id = ${userId} and used_at is null and revoked_at is null`;
  const token = newInviteToken();
  const [row] = await tx<{ expires_at: Date }[]>`
    insert into invites (token, group_id, role, user_id, expires_at, created_by)
    values (${token}, null, 'staff', ${userId}, now() + make_interval(hours => ${STAFF_INVITE_HOURS}), ${by})
    returning expires_at`;
  return { token, expires_at: new Date(row.expires_at).toISOString() };
}

interface StaffRow {
  id: string;
  full_name: string | null;
  admin: boolean;
  methodist: boolean;
  linked: boolean;
  disabled: boolean;
  assignments: { id: string; group_id: string; group_title: string; role: string; subject_id: string | null }[];
  invite_token: string | null;
  invite_expires_at: Date | null;
}

async function loadStaff(sql: postgres.Sql, onlyId?: string) {
  const rows = await sql<StaffRow[]>`
    select u.id, u.full_name,
           exists (select 1 from staff_roles r where r.user_id = u.id and r.role = 'admin') as admin,
           exists (select 1 from staff_roles r where r.user_id = u.id and r.role = 'methodist') as methodist,
           (u.telegram_user_id is not null) as linked,
           (u.disabled_at is not null) as disabled,
           coalesce((select json_agg(json_build_object('id', a.id, 'group_id', a.group_id, 'group_title', g.title,
                                                       'role', a.role, 'subject_id', a.subject_id)
                                     order by g.title, a.role, a.subject_id)
                       from staff_assignments a join groups g on g.id = a.group_id
                      where a.user_id = u.id), '[]') as assignments,
           inv.token as invite_token, inv.expires_at as invite_expires_at
      from users u
      left join lateral (
        select i.token, i.expires_at from invites i
         where i.user_id = u.id and i.role = 'staff' and i.used_at is null and i.revoked_at is null
           and i.expires_at > now()
         limit 1) inv on true
     where u.role in ('teacher','admin')
       and (${onlyId ?? null}::uuid is null or u.id = ${onlyId ?? null}::uuid)
     order by u.disabled_at nulls first, u.full_name nulls last, u.created_at`;
  return rows.map(({ invite_token, invite_expires_at, ...s }) => ({
    ...s,
    invite: invite_token ? { token: invite_token, expires_at: new Date(invite_expires_at!).toISOString() } : null,
  }));
}

async function adminsActive(sql: postgres.Sql): Promise<number> {
  const [row] = await sql<{ n: number }[]>`
    select count(*)::int as n from staff_roles r join users u on u.id = r.user_id
     where r.role = 'admin' and u.disabled_at is null`;
  return row.n;
}

async function admin(req: Request): Promise<{ sql: postgres.Sql; me: Staff }> {
  const identity = requireIdentity(req);
  const sql = db();
  return { sql, me: await requireAdmin(sql, identity.telegramUserId) };
}

// ── Сотрудники ──────────────────────────────────────────────

export async function getAdminStaff(req: Request): Promise<Response> {
  const { sql } = await admin(req);
  return json(200, { staff: await loadStaff(sql), admins_active: await adminsActive(sql) });
}

export async function postAdminStaff(req: Request): Promise<Response> {
  const { sql, me } = await admin(req);
  const body = await readJson(req);
  const fullName = staffName(body.full_name);
  const isAdmin = flag(body, 'admin');
  const isMethodist = flag(body, 'methodist');
  const assignments = (Array.isArray(body.assignments) ? body.assignments : []).map(assignmentOf);
  if (assignments.length > 50) throw new HttpError(400, 'too_many', 'Не больше 50 назначений за раз.');

  const { id, invite } = await sql
    .begin(async (tx) => {
      const [{ id }] = await tx<{ id: string }[]>`
        insert into users (full_name, full_name_source, role)
        values (${fullName}, 'roster', 'teacher') returning id`;
      await setCollegeRole(tx, id, 'admin', isAdmin, me.id);
      await setCollegeRole(tx, id, 'methodist', isMethodist, me.id);
      for (const a of assignments) await assign(tx, id, a, me.id);
      return { id, invite: await issueStaffInvite(tx, id, me.id) };
    })
    .catch(dbError);
  const [staff] = await loadStaff(sql, id);
  return json(201, { staff, invite });
}

export async function patchAdminStaff(req: Request): Promise<Response> {
  const id = idAt(req, 4, 'staff_not_found');
  const { sql, me } = await admin(req);
  const body = await readJson(req);
  const fullName = 'full_name' in body ? staffName(body.full_name) : undefined;
  const isAdmin = flag(body, 'admin');
  const isMethodist = flag(body, 'methodist');
  if (fullName === undefined && isAdmin === undefined && isMethodist === undefined) {
    throw new HttpError(400, 'nothing_to_update', 'Нечего менять.');
  }
  await sql
    .begin(async (tx) => {
      await requireStaffMember(tx, id);
      if (fullName !== undefined) await tx`update users set full_name = ${fullName}, full_name_source = 'roster' where id = ${id}`;
      await setCollegeRole(tx, id, 'admin', isAdmin, me.id);
      await setCollegeRole(tx, id, 'methodist', isMethodist, me.id);
    })
    .catch(dbError);
  const [staff] = await loadStaff(sql, id);
  return json(200, { staff, admins_active: await adminsActive(sql) });
}

export async function postAdminAssignment(req: Request): Promise<Response> {
  const id = idAt(req, 4, 'staff_not_found');
  const { sql, me } = await admin(req);
  const a = assignmentOf(await readJson(req));
  await sql
    .begin(async (tx) => {
      await requireStaffMember(tx, id);
      await assign(tx, id, a, me.id);
    })
    .catch(dbError);
  const [staff] = await loadStaff(sql, id);
  return json(201, { staff });
}

export async function deleteAdminAssignment(req: Request): Promise<Response> {
  const id = idAt(req, 4, 'staff_not_found');
  const assignmentId = idAt(req, 6, 'assignment_not_found');
  const { sql } = await admin(req);
  const rows = await sql`delete from staff_assignments where id = ${assignmentId} and user_id = ${id} returning id`;
  if (!rows.length) throw new HttpError(404, 'assignment_not_found', 'Назначение не найдено.');
  const [staff] = await loadStaff(sql, id);
  return json(200, { staff });
}

export async function postAdminStaffInvite(req: Request): Promise<Response> {
  const id = idAt(req, 4, 'staff_not_found');
  const { sql, me } = await admin(req);
  const body = await readJson(req).catch(() => ({}) as Record<string, unknown>);
  const relink = body.relink === true;
  const invite = await sql.begin(async (tx) => {
    const [u] = await tx<{ linked: boolean; disabled: boolean }[]>`
      select (telegram_user_id is not null) as linked, (disabled_at is not null) as disabled
        from users where id = ${id} and role in ('teacher','admin') for update`;
    if (!u) throw new HttpError(404, 'staff_not_found', 'Сотрудник не найден.');
    if (u.disabled) throw new HttpError(409, 'disabled', 'Сотрудник отключён. Сначала «Вернуть».');
    if (u.linked && !relink) {
      throw new HttpError(409, 'already_linked', 'Сотрудник уже вошёл. Если сменил Telegram — новая ссылка с отвязкой.');
    }
    if (relink) {
      if (id === me.id) throw new HttpError(400, 'self', 'Свой Telegram отвязать нельзя — попросите другого администратора.');
      await tx`update users set telegram_user_id = null where id = ${id}`;
    }
    return issueStaffInvite(tx, id, me.id);
  });
  // Журнал: кто кому выдал ссылку — без самой ссылки и Telegram ID
  console.info('admin staff invite', { by: me.id, staff: id, relink });
  return json(200, { invite });
}

export async function postAdminStaffDisable(req: Request): Promise<Response> {
  const id = idAt(req, 4, 'staff_not_found');
  const { sql, me } = await admin(req);
  if (id === me.id) throw new HttpError(400, 'self', 'Себя отключить нельзя — попросите другого администратора.');
  await sql
    .begin(async (tx) => {
      await requireStaffMember(tx, id);
      await tx`
        update invites set revoked_at = now()
         where user_id = ${id} and used_at is null and revoked_at is null`;
      await tx`update users set disabled_at = coalesce(disabled_at, now()), telegram_user_id = null where id = ${id}`;
    })
    .catch(dbError);
  console.info('admin staff disable', { by: me.id, staff: id });
  const [staff] = await loadStaff(sql, id);
  return json(200, { staff, admins_active: await adminsActive(sql) });
}

export async function postAdminStaffEnable(req: Request): Promise<Response> {
  const id = idAt(req, 4, 'staff_not_found');
  const { sql } = await admin(req);
  await requireStaffMember(sql, id);
  await sql`update users set disabled_at = null where id = ${id}`;
  const [staff] = await loadStaff(sql, id);
  return json(200, { staff, admins_active: await adminsActive(sql) });
}

// ── Группы ──────────────────────────────────────────────────

function groupFields(body: Record<string, unknown>, required: boolean): { title?: string; language?: 'ru' | 'kk' } {
  const out: { title?: string; language?: 'ru' | 'kk' } = {};
  if ('title' in body || required) {
    const title = typeof body.title === 'string' ? body.title.trim().replace(/\s+/g, ' ') : '';
    if (!GROUP_TITLE.test(title)) throw new HttpError(400, 'bad_title', 'Название группы: до 60 символов, например «ИС-21».');
    out.title = title;
  }
  if ('language' in body) {
    if (body.language !== 'ru' && body.language !== 'kk') throw new HttpError(400, 'bad_language', 'Язык группы: ru или kk.');
    out.language = body.language;
  }
  return out;
}

async function loadGroups(sql: postgres.Sql, onlyId?: string) {
  return sql`
    select g.id, g.title, g.language,
           (select count(*)::int from group_members m where m.group_id = g.id and m.role = 'student') as students,
           coalesce((select json_agg(json_build_object('user_id', a.user_id, 'full_name', u.full_name,
                                                       'role', a.role, 'subject_id', a.subject_id)
                                     order by a.role, u.full_name)
                       from staff_assignments a join users u on u.id = a.user_id
                      where a.group_id = g.id and u.disabled_at is null), '[]') as staff
      from groups g
     where ${onlyId ?? null}::uuid is null or g.id = ${onlyId ?? null}::uuid
     order by g.title`;
}

export async function getAdminGroups(req: Request): Promise<Response> {
  const { sql } = await admin(req);
  const subjects = await sql`select id, title from subjects order by position, id`;
  return json(200, { groups: await loadGroups(sql), subjects });
}

export async function postAdminGroup(req: Request): Promise<Response> {
  const { sql } = await admin(req);
  const f = groupFields(await readJson(req), true);
  const [dup] = await sql`select 1 from groups where lower(title) = lower(${f.title!})`;
  if (dup) throw new HttpError(409, 'duplicate', 'Группа с таким названием уже есть.');
  const [{ id }] = await sql<{ id: string }[]>`
    insert into groups (title, language) values (${f.title!}, ${f.language ?? 'ru'}) returning id`;
  const [group] = await loadGroups(sql, id);
  return json(201, { group });
}

export async function patchAdminGroup(req: Request): Promise<Response> {
  const id = idAt(req, 4, 'group_not_found');
  const { sql } = await admin(req);
  const f = groupFields(await readJson(req), false);
  if (f.title === undefined && f.language === undefined) throw new HttpError(400, 'nothing_to_update', 'Нечего менять.');
  if (f.title !== undefined) {
    const [dup] = await sql`select 1 from groups where lower(title) = lower(${f.title}) and id <> ${id}`;
    if (dup) throw new HttpError(409, 'duplicate', 'Группа с таким названием уже есть.');
  }
  const rows = await sql`
    update groups set title = coalesce(${f.title ?? null}, title), language = coalesce(${f.language ?? null}, language)
     where id = ${id} returning id`;
  if (!rows.length) throw new HttpError(404, 'group_not_found', 'Группа не найдена.');
  const [group] = await loadGroups(sql, id);
  return json(200, { group });
}
