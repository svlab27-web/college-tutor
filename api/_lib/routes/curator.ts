// Кабинет куратора (#9), часть 1 — список группы, личные ссылки, согласие родителя.
//
// GET   /api/curator/groups                         — мои группы (у админа — все) со счётчиками
// GET   /api/curator/students?group_id=…            — список группы: ФИО, возраст, согласия, ссылка, вход
// POST  /api/curator/students                       — завести студента { group_id, full_name, birth_date | birth_year } + ссылка
// POST  /api/curator/students/bulk                  — список группы разом { group_id, students: [...] } (до 100), всё или ничего
// PATCH /api/curator/students/:id                   — исправить ФИО / дату рождения (закрывает «ошибку в ФИО»)
// POST  /api/curator/students/:id/invite            — новая личная ссылка, прежняя отзывается
// POST  /api/curator/students/:id/parental          — отметить согласие родителя { parent_name, document_ref, source? }
// DELETE /api/curator/students/:id/parental         — снять отметку (ошиблись студентом)
// POST  /api/curator/students/:id/unlink            — «отвязать Telegram», если ссылку перехватили (docs/api.md, п. 1)
//
// Дату рождения куратор видит — он её вносил. Студенту дата не отдаётся (me.ts).

import { db } from '../db';
import { HttpError, json } from '../http';
import {
  issueInvite,
  requireGroup,
  requireStaff,
  requireStudent,
  rosterFields,
  UUID,
} from '../curator';
import { CONSENT_DOC_VERSION, profileStatus, todayInKazakhstan } from '../profile';
import { readJson, requireIdentity } from '../session';

const NAME_ERROR_PREFIX = 'Ошибка в ФИО:'; // так help.ts записывает «сообщить об ошибке»

function studentId(req: Request): string {
  const id = new URL(req.url).pathname.split('/')[4] ?? '';
  if (!UUID.test(id)) throw new HttpError(404, 'student_not_found', 'Студент не найден в ваших группах.');
  return id;
}

interface StudentRow {
  id: string;
  full_name: string | null;
  birth_year: number | null;
  birth_date: string | null;
  linked: boolean;
  has_consent: boolean;
  parental_document: string | null;
  parental_at: string | null;
  invite_token: string | null;
  invite_expires_at: string | null;
  invite_expired: boolean;
  name_errors: number;
  open_help: number;
}

function studentOut(s: StudentRow, today: string) {
  const status = profileStatus({
    fullName: s.full_name,
    birth: { date: s.birth_date, year: s.birth_year },
    hasConsent: s.has_consent,
    hasParentalConsent: s.parental_document !== null,
    today,
  });
  return {
    id: s.id,
    full_name: s.full_name,
    birth_date: s.birth_date,
    birth_year: s.birth_year,
    minor: status.minor,
    linked: s.linked, // вошёл по личной ссылке (Telegram привязан)
    has_consent: s.has_consent,
    parental: s.parental_document ? { document_ref: s.parental_document, at: s.parental_at } : null,
    invite: s.invite_token
      ? { token: s.invite_token, expires_at: s.invite_expires_at, expired: s.invite_expired }
      : null,
    needs: status.needs,
    can_save_progress: status.canSaveProgress,
    name_errors: s.name_errors,
    open_help: s.open_help,
  };
}

async function loadStudents(groupId: string, onlyId?: string) {
  const sql = db();
  const rows = await sql<StudentRow[]>`
    select u.id, u.full_name, u.birth_year, u.birth_date::text,
           (u.telegram_user_id is not null) as linked,
           exists (select 1 from consents c where c.user_id = u.id and c.kind = 'personal_data'
                     and c.doc_version = ${CONSENT_DOC_VERSION} and c.revoked_at is null) as has_consent,
           pc.document_ref as parental_document, pc.granted_at as parental_at,
           inv.token as invite_token, inv.expires_at as invite_expires_at,
           coalesce(inv.expires_at <= now(), false) as invite_expired,
           (select count(*)::int from help_requests h
             where h.user_id = u.id and h.status = 'new' and h.text like ${NAME_ERROR_PREFIX + '%'}) as name_errors,
           (select count(*)::int from help_requests h
             where h.user_id = u.id and h.status = 'new' and h.text not like ${NAME_ERROR_PREFIX + '%'}) as open_help
      from group_members m
      join users u on u.id = m.user_id and u.role = 'student'
      left join lateral (
        select c.document_ref, c.granted_at from consents c
         where c.user_id = u.id and c.kind = 'parental' and c.revoked_at is null
         order by c.granted_at desc limit 1) pc on true
      left join lateral (
        select i.token, i.expires_at from invites i
         where i.user_id = u.id and i.used_at is null and i.revoked_at is null
         limit 1) inv on true
     where m.group_id = ${groupId} and m.role = 'student'
       and (${onlyId ?? null}::uuid is null or u.id = ${onlyId ?? null}::uuid)
     order by u.full_name nulls last, u.created_at`;
  const today = todayInKazakhstan();
  return rows.map((r) => studentOut(r, today));
}

export async function getCuratorGroups(req: Request): Promise<Response> {
  const identity = requireIdentity(req);
  const sql = db();
  const staff = await requireStaff(sql, identity.telegramUserId);
  const groups = await sql<{ id: string; title: string; language: string; students: number; linked: number }[]>`
    select g.id, g.title, g.language,
           count(s.user_id)::int as students,
           count(s.user_id) filter (where u.telegram_user_id is not null)::int as linked
      from groups g
      left join group_members s on s.group_id = g.id and s.role = 'student'
      left join users u on u.id = s.user_id
     where ${staff.role === 'admin'} or exists (
             select 1 from group_members t where t.group_id = g.id and t.user_id = ${staff.id} and t.role = 'teacher')
     group by g.id
     order by g.title`;
  return json(200, { role: staff.role, groups });
}

export async function getCuratorStudents(req: Request): Promise<Response> {
  const identity = requireIdentity(req);
  const sql = db();
  const staff = await requireStaff(sql, identity.telegramUserId);
  const groupId = await requireGroup(sql, staff, new URL(req.url).searchParams.get('group_id'));
  return json(200, { group_id: groupId, students: await loadStudents(groupId) });
}

export async function postCuratorStudent(req: Request): Promise<Response> {
  const identity = requireIdentity(req);
  const body = await readJson(req);
  const sql = db();
  const staff = await requireStaff(sql, identity.telegramUserId);
  const groupId = await requireGroup(sql, staff, body.group_id);
  const f = rosterFields(body, true);
  // Как в bulk: такой студент уже есть в группе — 409, куратор может подтвердить (force: true) — бывают тёзки
  if (body.force !== true) {
    const [dup] = await sql<{ id: string }[]>`
      select u.id from group_members m join users u on u.id = m.user_id
       where m.group_id = ${groupId} and m.role = 'student'
         and lower(u.full_name) = lower(${f.full_name!}) and u.birth_year = ${f.birth_year!}
       limit 1`;
    if (dup) throw new HttpError(409, 'duplicate', 'Такой студент уже есть в группе. Добавить ещё одного (тёзку)?');
  }

  const id = await sql.begin(async (tx) => {
    const [{ id }] = await tx<{ id: string }[]>`
      insert into users (full_name, full_name_source, birth_year, birth_date, role)
      values (${f.full_name!}, 'roster', ${f.birth_year!}, ${f.birth_date ?? null}, 'student')
      returning id`;
    await tx`insert into group_members (group_id, user_id, role) values (${groupId}, ${id}, 'student')`;
    await issueInvite(tx, id, groupId, staff.id);
    return id;
  });
  const [student] = await loadStudents(groupId, id);
  return json(201, { student });
}

const MAX_BULK = 100;

// Список группы разом (вставили текстом или загрузили файл — разбирает и показывает для правки браузер).
// Всё или ничего: если хоть одна строка неверна или повторяется — 400 с номерами строк, в базу ничего.
export async function postCuratorStudentsBulk(req: Request): Promise<Response> {
  const identity = requireIdentity(req);
  const body = await readJson(req);
  const sql = db();
  const staff = await requireStaff(sql, identity.telegramUserId);
  const groupId = await requireGroup(sql, staff, body.group_id);
  const list = Array.isArray(body.students) ? body.students : [];
  if (!list.length) throw new HttpError(400, 'empty_list', 'Список пуст.');
  if (list.length > MAX_BULK) throw new HttpError(400, 'too_many', `За раз — не больше ${MAX_BULK} студентов.`);

  const existing = new Set(
    (await sql<{ k: string }[]>`
      select lower(u.full_name) || '|' || u.birth_year as k
        from group_members m join users u on u.id = m.user_id
       where m.group_id = ${groupId} and m.role = 'student'`).map((r) => r.k),
  );
  const seen = new Set<string>();
  const rows: { index: number; message: string }[] = [];
  const valid = list.map((raw: unknown, index: number) => {
    try {
      if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new HttpError(400, 'bad_row', 'Пустая строка.');
      const f = rosterFields(raw as Record<string, unknown>, true);
      const key = `${f.full_name!.toLowerCase()}|${f.birth_year}`;
      if (existing.has(key)) throw new HttpError(400, 'duplicate', 'Такой студент уже есть в группе.');
      if (seen.has(key)) throw new HttpError(400, 'duplicate', 'Повторяется в списке.');
      seen.add(key);
      return f;
    } catch (e) {
      rows.push({ index, message: e instanceof HttpError ? e.message : 'Ошибка в строке.' });
      return null;
    }
  });
  if (rows.length) {
    return json(400, { error: 'bad_rows', message: `Проверьте строки: ${rows.map((r) => r.index + 1).join(', ')}.`, rows });
  }

  const ids = await sql.begin(async (tx) => {
    const out: string[] = [];
    for (const f of valid) {
      const [{ id }] = await tx<{ id: string }[]>`
        insert into users (full_name, full_name_source, birth_year, birth_date, role)
        values (${f!.full_name!}, 'roster', ${f!.birth_year!}, ${f!.birth_date ?? null}, 'student')
        returning id`;
      await tx`insert into group_members (group_id, user_id, role) values (${groupId}, ${id}, 'student')`;
      await issueInvite(tx, id, groupId, staff.id);
      out.push(id);
    }
    return out;
  });
  const created = new Set(ids);
  const students = (await loadStudents(groupId)).filter((s) => created.has(s.id));
  return json(201, { created: students.length, students });
}

export async function patchCuratorStudent(req: Request): Promise<Response> {
  const identity = requireIdentity(req);
  const id = studentId(req);
  const body = await readJson(req);
  const sql = db();
  const staff = await requireStaff(sql, identity.telegramUserId);
  const { groupId } = await requireStudent(sql, staff, id);
  const f = rosterFields(body, false);
  if (f.full_name === undefined && f.birth_year === undefined) {
    throw new HttpError(400, 'nothing_to_update', 'Укажите ФИО или дату рождения.');
  }

  await sql.begin(async (tx) => {
    await tx`
      update users set
        full_name = coalesce(${f.full_name ?? null}, full_name),
        full_name_source = 'roster',
        birth_year = coalesce(${f.birth_year ?? null}::smallint, birth_year),
        birth_date = case when ${f.birth_year !== undefined} then ${f.birth_date ?? null}::date else birth_date end
      where id = ${id}`;
    // Куратор исправил ФИО — обращения «ошибка в ФИО» закрываем
    if (f.full_name !== undefined) {
      await tx`
        update help_requests set status = 'resolved', resolved_at = now()
         where user_id = ${id} and status = 'new' and text like ${NAME_ERROR_PREFIX + '%'}`;
    }
  });
  const [student] = await loadStudents(groupId, id);
  return json(200, { student });
}

export async function postCuratorInvite(req: Request): Promise<Response> {
  const identity = requireIdentity(req);
  const id = studentId(req);
  const sql = db();
  const staff = await requireStaff(sql, identity.telegramUserId);
  const { groupId } = await requireStudent(sql, staff, id);
  const [linked] = await sql<{ linked: boolean }[]>`select (telegram_user_id is not null) as linked from users where id = ${id}`;
  if (linked?.linked) {
    throw new HttpError(409, 'already_linked', 'Студент уже вошёл. Если вошёл не он — сначала «Отвязать Telegram», потом новая ссылка.');
  }
  const invite = await sql.begin((tx) => issueInvite(tx, id, groupId, staff.id));
  return json(200, { invite });
}

export async function postCuratorParental(req: Request): Promise<Response> {
  const identity = requireIdentity(req);
  const id = studentId(req);
  const body = await readJson(req);
  const sql = db();
  const staff = await requireStaff(sql, identity.telegramUserId);
  const { groupId } = await requireStudent(sql, staff, id);

  const parentName = typeof body.parent_name === 'string' ? body.parent_name.trim() : '';
  const documentRef = typeof body.document_ref === 'string' ? body.document_ref.trim() : '';
  const source = body.source === 'college_list' ? 'college_list' : 'paper';
  if (parentName.length < 3 || parentName.length > 120) {
    throw new HttpError(400, 'bad_parent_name', 'Укажите ФИО родителя (законного представителя).');
  }
  if (documentRef.length < 2 || documentRef.length > 120) {
    throw new HttpError(400, 'bad_document_ref', 'Укажите, где лежит бланк — например, «личное дело № 12».');
  }

  await sql.begin(async (tx) => {
    // Блокируем строку студента: два одновременных нажатия идут по очереди (до индекса из 006)
    await tx`select id from users where id = ${id} for update`;
    const [active] = await tx<{ id: string }[]>`
      select id from consents where user_id = ${id} and kind = 'parental' and revoked_at is null`;
    if (active) throw new HttpError(409, 'parental_exists', 'Согласие родителя уже отмечено.');
    // Сканы не храним — только где лежит бумага (005); Telegram студента здесь не нужен
    await tx`
      insert into consents (user_id, kind, doc_version, granted_via, parent_name, document_ref, recorded_by)
      values (${id}, 'parental', ${CONSENT_DOC_VERSION}, ${source}, ${parentName}, ${documentRef}, ${staff.id})`;
  }).catch((e) => {
    // Уникальный индекс на действующее согласие родителя (006) — тоже «уже отмечено»
    if ((e as { code?: string }).code === '23505') throw new HttpError(409, 'parental_exists', 'Согласие родителя уже отмечено.');
    throw e;
  });
  const [student] = await loadStudents(groupId, id);
  return json(200, { student });
}

export async function deleteCuratorParental(req: Request): Promise<Response> {
  const identity = requireIdentity(req);
  const id = studentId(req);
  const sql = db();
  const staff = await requireStaff(sql, identity.telegramUserId);
  const { groupId } = await requireStudent(sql, staff, id);
  await sql`
    update consents set revoked_at = now()
     where user_id = ${id} and kind = 'parental' and revoked_at is null`;
  const [student] = await loadStudents(groupId, id);
  return json(200, { student });
}

export async function postCuratorUnlink(req: Request): Promise<Response> {
  const identity = requireIdentity(req);
  const id = studentId(req);
  const sql = db();
  const staff = await requireStaff(sql, identity.telegramUserId);
  const { groupId } = await requireStudent(sql, staff, id);

  await sql.begin(async (tx) => {
    await tx`select id from users where id = ${id} for update`;
    // Согласие на ПД давали с отвязанного Telegram — возможно, не сам студент. Отметка родителя остаётся.
    await tx`
      update consents set revoked_at = now()
       where user_id = ${id} and kind = 'personal_data' and revoked_at is null`;
    await tx`
      update invites set revoked_at = now()
       where user_id = ${id} and used_at is null and revoked_at is null`;
    await tx`update users set telegram_user_id = null where id = ${id}`;
  });
  // Журнал: кто и кого отвязал — без Telegram ID
  console.info('curator unlink', { by: staff.id, student: id, group: groupId });
  const [student] = await loadStudents(groupId, id);
  return json(200, { ok: true, student });
}
