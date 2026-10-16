// Уроки, ответы, прогресс (#6) — минимум к показу 16.10, контракт в docs/api.md, п. 2.
//
// GET  /api/lessons?lang=          — уроки (студенту — опубликованные) в порядке плана + прогресс
// GET  /api/lessons/:id?lang=      — урок без эталонов + прогресс; checks / free_input — у пройденных шагов
// POST /api/answer                 — проверить ответ на сервере; попытку и прогресс пишем,
//                                    только если can_save_progress (согласия есть)
//
// Незаведённый Telegram (демо) получает уроки и проверку, но в базу ничего не пишется.

import type postgres from 'postgres';
import { db } from '../db';
import { HttpError, json } from '../http';
import {
  afterSolved,
  BadAnswer,
  BrowserCheck,
  checkAnswer,
  hiddenFeedback,
  publicLesson,
  stepsOf,
  summarize,
  variantIndex,
  type LessonProgress,
  type Lang,
} from '../lessons';
import { CONSENT_DOC_VERSION, cleanLanguage, profileStatus, todayInKazakhstan } from '../profile';
import { readJson, requireIdentity } from '../session';
import { consentFlags, findUser, type UserRow } from '../users';

type Sql = postgres.Sql | postgres.TransactionSql;
type Obj = Record<string, unknown>;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const REQUEST_ID = /^[A-Za-z0-9_-]{8,64}$/;

// jsonb хранит ключи в своём порядке — сравниваем ответы без учёта порядка ключей
const canon = (o: Obj) => JSON.stringify(Object.keys(o).sort().map((k) => [k, o[k]]));

interface Viewer {
  telegramUserId: number;
  user: UserRow | undefined;
  staff: boolean;
  canSave: boolean;
}

async function viewer(sql: Sql, req: Request): Promise<Viewer> {
  const identity = requireIdentity(req);
  const user = await findUser(sql, identity.telegramUserId);
  let canSave = false;
  if (user) {
    const flags = await consentFlags(sql, user.id, CONSENT_DOC_VERSION);
    canSave = profileStatus({
      fullName: user.full_name,
      birth: { date: user.birth_date, year: user.birth_year },
      ...flags,
      today: todayInKazakhstan(),
    }).canSaveProgress;
  }
  const staff = user?.role === 'teacher' || user?.role === 'admin';
  return { telegramUserId: identity.telegramUserId, user, staff, canSave };
}

// Вариант самостоятельной задачи — по записи студента; в демо — по Telegram
const seedOf = (v: Viewer) => v.user?.id ?? `tg:${v.telegramUserId}`;

function langOf(req: Request, body?: Obj): Lang {
  return cleanLanguage(body?.lang ?? new URL(req.url).searchParams.get('lang')) ?? 'ru';
}

interface LessonRow {
  id: string;
  subject_id: string;
  slug: string;
  title: string;
  is_published: boolean;
  content: Obj;
  translation: Obj | null;
}

// Порядок плана семестра: предмет, неделя, номер в неделе, slug (#49: week / order в уроке)
const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : 999);
function byPlan(a: LessonRow, b: LessonRow): number {
  return (
    a.subject_id.localeCompare(b.subject_id) ||
    num(a.content.week) - num(b.content.week) ||
    num(a.content.order) - num(b.content.order) ||
    a.slug.localeCompare(b.slug)
  );
}

// Последняя версия каждого урока; перевод — только утверждённый
async function loadLessons(sql: Sql, v: Viewer, lang: Lang, id?: string): Promise<LessonRow[]> {
  const rows = await sql<LessonRow[]>`
    select l.id, l.subject_id, l.slug, l.title, l.is_published, l.content,
           (select t.content from lesson_translations t
             where t.lesson_id = l.id and t.language = ${lang} and t.status = 'approved') as translation
      from (select distinct on (subject_id, slug) * from lessons order by subject_id, slug, version desc) l
     where (${v.staff} or l.is_published)
       and (${id ?? null}::uuid is null or l.id = ${id ?? null}::uuid)`;
  return [...rows].sort(byPlan);
}

function contentOf(row: LessonRow): { content: Obj; language: Lang } {
  return row.translation ? { content: row.translation, language: 'kk' } : { content: row.content, language: 'ru' };
}

async function solvedSteps(sql: Sql, userId: string, lessonId: string): Promise<Set<string>> {
  const rows = await sql<{ step_id: string }[]>`
    select distinct step_id from attempts where user_id = ${userId} and lesson_id = ${lessonId} and is_correct`;
  return new Set(rows.map((r) => r.step_id));
}

async function lessonProgress(sql: Sql, userId: string, lessonId: string, content: Obj): Promise<LessonProgress | null> {
  const steps = stepsOf(content);
  const rows = await sql<{ step_id: string; solved: boolean; first_correct: boolean }[]>`
    select step_id, bool_or(is_correct) as solved,
           (array_agg(is_correct order by created_at))[1] as first_correct
      from attempts where user_id = ${userId} and lesson_id = ${lessonId}
     group by step_id`;
  if (!rows.length) return null;
  const [p] = await sql<{ completed_at: Date | null }[]>`
    select completed_at from progress where user_id = ${userId} and lesson_id = ${lessonId}`;
  const solved = new Set(rows.filter((r) => r.solved).map((r) => r.step_id));
  const { completed, current } = summarize(steps, solved);
  const indep = steps.find((s) => s.independent);
  const ir = indep ? rows.find((r) => r.step_id === indep.id) : undefined;
  return {
    lesson_id: lessonId,
    steps_total: steps.length,
    completed_steps: completed.length,
    completed,
    current_step: current,
    completed_at: p?.completed_at ? new Date(p.completed_at).toISOString() : null,
    independent: { solved: Boolean(ir?.solved), first_try: ir ? Boolean(ir.first_correct) : null },
  };
}

export async function getLessons(req: Request): Promise<Response> {
  const sql = db();
  const v = await viewer(sql, req);
  const lang = langOf(req);
  const rows = await loadLessons(sql, v, lang);
  type ProgressRow = { lesson_id: string; completed_steps: number; current_step: string | null; completed_at: Date | null };
  let progress: ProgressRow[] = [];
  if (v.user) {
    progress = await sql<ProgressRow[]>`
      select lesson_id, completed_steps, current_step, completed_at from progress where user_id = ${v.user.id}`;
  }
  const lessons = rows.map((row) => {
    const { content, language } = contentOf(row);
    const p = progress.find((x) => x.lesson_id === row.id);
    return {
      id: row.id,
      subject: row.subject_id,
      slug: row.slug,
      title: typeof content.title === 'string' ? content.title : row.title,
      skill: content.skill ?? null,
      minutes: content.minutes ?? null,
      week: content.week ?? null,
      order: content.order ?? null,
      language,
      is_published: row.is_published,
      steps_total: stepsOf(content).length,
      progress: p
        ? {
            completed_steps: p.completed_steps,
            current_step: p.current_step,
            completed_at: p.completed_at ? new Date(p.completed_at).toISOString() : null,
          }
        : null,
    };
  });
  return json(200, { can_save_progress: v.canSave, lessons });
}

function lessonIdFrom(req: Request): string {
  const id = new URL(req.url).pathname.split('/')[3] ?? '';
  if (!UUID.test(id)) throw new HttpError(404, 'lesson_not_found', 'Урок не найден.');
  return id;
}

async function requireLesson(sql: Sql, v: Viewer, lang: Lang, id: unknown): Promise<LessonRow> {
  if (typeof id !== 'string' || !UUID.test(id)) throw new HttpError(404, 'lesson_not_found', 'Урок не найден.');
  const [row] = await loadLessons(sql, v, lang, id);
  if (!row) throw new HttpError(404, 'lesson_not_found', 'Урок не найден.');
  return row;
}

export async function getLesson(req: Request): Promise<Response> {
  const sql = db();
  const v = await viewer(sql, req);
  const row = await requireLesson(sql, v, langOf(req), lessonIdFrom(req));
  const { content, language } = contentOf(row);
  const seed = seedOf(v);
  const solved = v.user ? await solvedSteps(sql, v.user.id, row.id) : new Set<string>();
  const lesson = {
    id: row.id,
    ...publicLesson(content, (s) => variantIndex(seed, row.id, s), solved),
    language,
    is_published: row.is_published,
  };
  const progress = v.user ? await lessonProgress(sql, v.user.id, row.id, row.content) : null;
  return json(200, { can_save_progress: v.canSave, lesson, progress });
}

export async function postAnswer(req: Request): Promise<Response> {
  const sql = db();
  const v = await viewer(sql, req);
  const body = await readJson(req);
  const lang = langOf(req, body);
  const row = await requireLesson(sql, v, lang, body.lesson_id);
  const { content, language } = contentOf(row);
  const step = stepsOf(content).find((s) => s.id === body.step_id);
  if (typeof body.step_id !== 'string' || !step) throw new HttpError(404, 'step_not_found', 'Шаг урока не найден.');
  if (typeof body.request_id !== 'string' || !REQUEST_ID.test(body.request_id)) {
    throw new HttpError(400, 'bad_request_id', 'Обновите приложение и попробуйте ещё раз.');
  }
  const requestId = body.request_id;

  const variant = variantIndex(seedOf(v), row.id, step);
  let result;
  try {
    result = checkAnswer(step, variant, body.answer, language);
  } catch (e) {
    if (e instanceof BadAnswer) throw new HttpError(400, 'bad_answer', 'Не удалось прочитать ответ. Попробуйте ещё раз.');
    if (e instanceof BrowserCheck) throw new HttpError(422, 'browser_check', 'Этот ответ проверяется в приложении.');
    throw e;
  }
  const { stored, ...check } = result;
  // Таблица проверки и «напиши код» — только после верного ответа (они выдают ответ шага)
  const reveal = check.correct ? afterSolved(step) : undefined;

  if (!v.user || !v.canSave) {
    // Заведённый студент без согласий не должен перебирать самостоятельную: после согласия первая
    // записанная попытка засчиталась бы «с первой попытки». Демо (Telegram не заведён) — проверяем.
    if (v.user && step.independent) {
      return json(200, { correct: null, feedback: hiddenFeedback(language), saved: false, progress: null });
    }
    return json(200, { ...check, ...(reveal ? { reveal } : {}), saved: false, progress: null });
  }

  const userId = v.user.id;
  const hints = step.independent ? 0 : Math.min(3, Math.max(0, Number.isInteger(body.hints_used) ? (body.hints_used as number) : 0));
  const outcome = await sql.begin(async (tx) => {
    // Ответы одного студента по одному уроку — по очереди, чтобы прогресс не считался по устаревшим попыткам
    await tx`select pg_advisory_xact_lock(hashtextextended(${`${userId}:${row.id}`}, 0))`;
    const inserted = await tx<{ id: string }[]>`
      insert into attempts (user_id, lesson_id, step_id, answer, is_correct, hints_used, is_independent, request_id, language)
      values (${userId}, ${row.id}, ${step.id}, ${tx.json(stored as never)}, ${check.correct},
              ${hints}, ${Boolean(step.independent)}, ${requestId}, ${language})
      on conflict (user_id, request_id) do nothing
      returning id`;
    if (!inserted.length) {
      // Повтор того же нажатия: отвечаем по записанной попытке. Тот же request_id для другого
      // шага или с другим ответом — ошибка клиента, а не новая попытка.
      const [prev] = await tx<{ lesson_id: string; step_id: string; answer: Obj; is_correct: boolean }[]>`
        select lesson_id, step_id, answer, is_correct from attempts where user_id = ${userId} and request_id = ${requestId}`;
      if (!prev || prev.lesson_id !== row.id || prev.step_id !== step.id || canon(prev.answer) !== canon(stored)) {
        throw new HttpError(409, 'request_reused', 'Обновите приложение и попробуйте ещё раз.');
      }
      return { correct: prev.is_correct, progress: (await lessonProgress(tx, userId, row.id, row.content))! };
    }
    // Прогресс считаем по основному тексту урока (структура перевода с ним совпадает, 003)
    const p = (await lessonProgress(tx, userId, row.id, row.content))!;
    await tx`
      insert into progress (user_id, lesson_id, current_step, completed_steps, completed_at, updated_at)
      values (${userId}, ${row.id}, ${p.current_step}, ${p.completed_steps},
              ${p.current_step === null ? new Date() : null}, now())
      on conflict (user_id, lesson_id) do update
        set current_step = excluded.current_step,
            completed_steps = excluded.completed_steps,
            completed_at = coalesce(progress.completed_at, excluded.completed_at),
            updated_at = now()`;
    return { correct: check.correct, progress: (await lessonProgress(tx, userId, row.id, row.content))! };
  });
  return json(200, { ...check, ...(reveal ? { reveal } : {}), saved: true, progress: outcome.progress });
}
