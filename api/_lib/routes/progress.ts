// GET /api/curator/progress?group_id= — вкладка «Прогресс» у куратора (только чтение, #6 к показу).
// Доступ (api/_lib/staff.ts): куратор и педагог группы, методист, администратор колледжа; чужое — 404.
// Педагог (не куратор этой группы) видит только уроки своих предметов.
// Студенты × уроки: пройдено шагов, текущий шаг, последняя активность, попытки, подсказки,
// самостоятельная — решена / с первой попытки. Ответы студентов наружу не отдаём.

import { db } from '../db';
import { json } from '../http';
import { stepsOf } from '../lessons';
import { CONSENT_DOC_VERSION, profileStatus, todayInKazakhstan } from '../profile';
import { requireIdentity } from '../session';
import { requireGroup, requireStaff, staffGroups } from '../staff';

export async function getCuratorProgress(req: Request): Promise<Response> {
  const identity = requireIdentity(req);
  const sql = db();
  const staff = await requireStaff(sql, identity.telegramUserId);
  const groupId = await requireGroup(sql, staff, new URL(req.url).searchParams.get('group_id'), 'read');
  const mine = (await staffGroups(sql, staff)).find((g) => g.id === groupId);
  const onlySubjects = staff.admin || staff.methodist || mine?.curator ? null : (mine?.subjects ?? []);

  // Куратор видит и неопубликованные уроки — как в /api/lessons
  const all = await sql<{ id: string; subject: string; slug: string; title: string; content: Record<string, unknown> }[]>`
    select id, subject_id as subject, slug, title, content
      from (select distinct on (subject_id, slug) * from lessons order by subject_id, slug, version desc) l`;
  const rows = onlySubjects ? all.filter((l) => onlySubjects.includes(l.subject)) : all;
  // Попытки бывают и по прежним версиям урока — фильтр по предмету, а не по id последней версии
  const visible = onlySubjects
    ? new Set((await sql<{ id: string }[]>`select id from lessons where subject_id in ${sql(onlySubjects.length ? onlySubjects : [''])}`).map((l) => l.id))
    : null;
  // Порядок плана семестра — как в /api/lessons: предмет, неделя, номер в неделе, slug
  const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : 999);
  const lessons = [...rows].sort(
    (a, b) =>
      a.subject.localeCompare(b.subject) ||
      num(a.content.week) - num(b.content.week) ||
      num(a.content.order) - num(b.content.order) ||
      a.slug.localeCompare(b.slug),
  );

  const students = await sql<
    { id: string; full_name: string | null; birth_date: string | null; birth_year: number | null; consent: boolean; parental: boolean }[]
  >`
    select u.id, u.full_name, u.birth_date::text, u.birth_year,
           exists (select 1 from consents c where c.user_id = u.id and c.kind = 'personal_data'
                     and c.doc_version = ${CONSENT_DOC_VERSION} and c.revoked_at is null) as consent,
           exists (select 1 from consents c where c.user_id = u.id and c.kind = 'parental'
                     and c.revoked_at is null) as parental
      from group_members m join users u on u.id = m.user_id and u.role = 'student'
     where m.group_id = ${groupId} and m.role = 'student'
     order by u.full_name nulls last, u.created_at`;

  const stats = await sql<
    {
      user_id: string;
      lesson_id: string;
      attempts: number;
      hints_used: number;
      last_activity: Date;
      ind_solved: boolean | null;
      ind_first: boolean | null;
      completed_steps: number | null;
      current_step: string | null;
      completed_at: Date | null;
    }[]
  >`
    select a.user_id, a.lesson_id, count(*)::int as attempts, coalesce(sum(a.hints_used), 0)::int as hints_used,
           max(a.created_at) as last_activity,
           bool_or(a.is_correct) filter (where a.is_independent) as ind_solved,
           (array_agg(a.is_correct order by a.created_at) filter (where a.is_independent))[1] as ind_first,
           p.completed_steps, p.current_step, p.completed_at
      from attempts a
      join group_members m on m.user_id = a.user_id and m.group_id = ${groupId} and m.role = 'student'
      left join progress p on p.user_id = a.user_id and p.lesson_id = a.lesson_id
     group by a.user_id, a.lesson_id, p.completed_steps, p.current_step, p.completed_at`;

  const today = todayInKazakhstan();
  return json(200, {
    group_id: groupId,
    lessons: lessons.map((l) => ({ id: l.id, subject: l.subject, slug: l.slug, title: l.title, steps_total: stepsOf(l.content).length })),
    students: students.map((s) => ({
      id: s.id,
      full_name: s.full_name,
      can_save_progress: profileStatus({
        fullName: s.full_name,
        birth: { date: s.birth_date, year: s.birth_year },
        hasConsent: s.consent,
        hasParentalConsent: s.parental,
        today,
      }).canSaveProgress,
      lessons: Object.fromEntries(
        stats
          .filter((r) => r.user_id === s.id && (!visible || visible.has(r.lesson_id)))
          .map((r) => [
            r.lesson_id,
            {
              completed_steps: r.completed_steps ?? 0,
              current_step: r.current_step,
              completed_at: r.completed_at ? new Date(r.completed_at).toISOString() : null,
              last_activity: new Date(r.last_activity).toISOString(),
              attempts: r.attempts,
              hints_used: r.hints_used,
              independent: { solved: Boolean(r.ind_solved), first_try: r.ind_first === null ? null : Boolean(r.ind_first) },
            },
          ]),
      ),
    })),
  });
}
