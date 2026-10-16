// Уроки, ответы, прогресс (#6) на настоящем Postgres с миграциями 001–006.
// Запускается, только если задан TEST_DATABASE_URL (в CI — чистая база в контейнере).
// Никогда не указывайте здесь рабочую базу: тест создаёт свои уроки, группы и пользователей.

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { after, before, test } from 'node:test';
import { signInitData } from '../api/_lib/auth';
import { closeDb, db } from '../api/_lib/db';
import { stepsOf, variantIndex, type Step } from '../api/_lib/lessons';
import { CONSENT_DOC_VERSION } from '../api/_lib/profile';
import { route } from '../api/_lib/router';

const url = process.env.TEST_DATABASE_URL;
const BOT_TOKEN = '123456789:TEST_ONLY_not_a_real_token';
const opts = { skip: url ? false : 'нет TEST_DATABASE_URL' };
const run = Date.now().toString(36);
const CONTENT = resolve(__dirname, '..', '..', 'content');
const load = (p: string) => JSON.parse(readFileSync(resolve(CONTENT, p), 'utf8')) as Record<string, unknown>;
const python = load('python/01-skidka-v-kafe.json');
const pythonKk = load('python/01-skidka-v-kafe.kk.json');
const math = load('math/01-dvor-maks-ploshchadi.json');

let groupId = '';
let curatorTg = 0;
let pyId = '';
let mathId = '';
let hiddenId = '';
let nextTg = Math.floor(Date.now() / 1000) * 1000 + 700_000;

async function lesson(subject: string, content: Record<string, unknown>, published: boolean): Promise<string> {
  const slug = `${content.slug}-t${run}${published ? '' : '-draft'}`;
  const [{ id }] = await db()<{ id: string }[]>`
    insert into lessons (subject_id, slug, title, version, content, language, is_published)
    values (${subject}, ${slug}, ${content.title as string}, 1, ${db().json(content as never)}, 'ru', ${published})
    returning id`;
  return id;
}

before(async () => {
  if (!url) return;
  process.env.DATABASE_URL = url;
  process.env.BOT_TOKEN = BOT_TOKEN;
  const sql = db();
  [{ id: groupId }] = await sql<{ id: string }[]>`insert into groups (title) values ('Уроки тест') returning id`;
  curatorTg = ++nextTg;
  const [{ id: curatorId }] = await sql<{ id: string }[]>`
    insert into users (full_name, full_name_source, birth_year, role, telegram_user_id)
    values ('Куратор Уроков', 'roster', 1985, 'teacher', ${curatorTg}) returning id`;
  await sql`insert into group_members (group_id, user_id, role) values (${groupId}, ${curatorId}, 'teacher')`;
  pyId = await lesson('python', python, true);
  mathId = await lesson('math', math, true);
  hiddenId = await lesson('python', python, false);
  await sql`
    insert into lesson_translations (lesson_id, language, content, status)
    values (${pyId}, 'kk', ${sql.json(pythonKk as never)}, 'approved')`;
});

after(async () => {
  if (url) await closeDb();
});

// Студент, уже вошедший по ссылке: Telegram привязан, согласия — как в сценарии
async function student(o: { date?: string; consent?: boolean; parental?: boolean } = {}) {
  const sql = db();
  const tg = ++nextTg;
  const date = o.date ?? '2000-05-05';
  const [{ id }] = await sql<{ id: string }[]>`
    insert into users (full_name, full_name_source, birth_year, birth_date, role, telegram_user_id)
    values ('Студент Уроков', 'roster', ${Number(date.slice(0, 4))}, ${date}, 'student', ${tg}) returning id`;
  await sql`insert into group_members (group_id, user_id, role) values (${groupId}, ${id}, 'student')`;
  if (o.consent !== false) {
    await sql`insert into consents (user_id, telegram_user_id, kind, doc_version, granted_via)
              values (${id}, ${tg}, 'personal_data', ${CONSENT_DOC_VERSION}, 'telegram')`;
  }
  return { id, tg };
}

function initData(telegramId: number): string {
  const fields = {
    auth_date: String(Math.floor(Date.now() / 1000)),
    user: JSON.stringify({ id: telegramId, first_name: 'Тест' }),
  };
  return new URLSearchParams({ ...fields, hash: signInitData(fields, BOT_TOKEN) }).toString();
}

async function call(method: string, path: string, telegramId: number, body?: unknown) {
  const res = await route(
    new Request(`http://localhost${path}`, {
      method,
      headers: { 'x-telegram-init-data': initData(telegramId), 'content-type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    }),
  );
  return { status: res.status, body: (await res.json()) as any };
}

let req = 0;
const answer = (tg: number, lessonId: string, stepId: string, a: unknown, extra: Record<string, unknown> = {}) =>
  call('POST', '/api/answer', tg, { lesson_id: lessonId, step_id: stepId, answer: a, request_id: `r-${run}-${++req}`, ...extra });

// Верный ответ на шаг для варианта v (0 — основной текст)
function answerFor(s: Step, v: number): unknown {
  const src = (v > 0 ? (s.variants as any[])[v - 1] : s) as any;
  const expected = src.expected ?? s.expected;
  if (s.answer_type === 'number') return String((expected as any).value);
  const np = src.number_part ?? s.number_part;
  return np ? { choice: expected, number: String(np.expected.value) } : expected;
}

// Верный ответ своего варианта (вариант выбирает сервер по записи студента)
const rightAnswer = (s: Step, seed: string, lessonId: string) => answerFor(s, variantIndex(seed, lessonId, s));

async function attemptsOf(userId: string) {
  const [{ n }] = await db()<{ n: number }[]>`select count(*)::int as n from attempts where user_id = ${userId}`;
  return n;
}

test('демо (Telegram не заведён): уроки и проверка есть, в базу ничего', opts, async () => {
  const tg = ++nextTg;
  const list = await call('GET', '/api/lessons', tg);
  assert.equal(list.status, 200);
  assert.equal(list.body.can_save_progress, false);
  const ids = list.body.lessons.map((l: any) => l.id);
  assert.ok(ids.includes(pyId) && ids.includes(mathId));
  assert.ok(!ids.includes(hiddenId), 'неопубликованный урок студенту не показываем');
  const ok = await answer(tg, pyId, 's1', 0);
  assert.equal(ok.status, 200);
  assert.equal(ok.body.correct, true);
  assert.equal(ok.body.saved, false);
  assert.equal(ok.body.progress, null);
  const [{ n }] = await db()<{ n: number }[]>`select count(*)::int as n from attempts where lesson_id = ${pyId} and request_id like ${`r-${run}-${req}`}`;
  assert.equal(n, 0);
});

test('урок для браузера: без эталонов; неопубликованный студенту — 404', opts, async () => {
  const s = await student();
  const r = await call('GET', `/api/lessons/${pyId}`, s.tg);
  assert.equal(r.status, 200);
  assert.equal(r.body.lesson.language, 'ru');
  const text = JSON.stringify(r.body.lesson);
  for (const key of ['"solution"', '"variants"', '"common_mistakes"', '"checks"', '"free_input"']) assert.ok(!text.includes(key), key);
  for (const st of r.body.lesson.steps) assert.equal(st.expected, undefined);
  assert.equal(r.body.progress, null);
  assert.equal((await call('GET', `/api/lessons/${hiddenId}`, s.tg)).status, 404);
  assert.equal((await call('GET', '/api/lessons/not-a-uuid', s.tg)).status, 404);
});

test('казахский: утверждённый перевод → language kk и ответ по-казахски', opts, async () => {
  const s = await student();
  const r = await call('GET', `/api/lessons/${pyId}?lang=kk`, s.tg);
  assert.equal(r.body.lesson.language, 'kk');
  assert.equal((await answer(s.tg, pyId, 's1', 0, { lang: 'kk' })).body.feedback, 'Дұрыс!');
  // у математики перевода нет (в тесте не утверждён) — основной язык
  assert.equal((await call('GET', `/api/lessons/${mathId}?lang=kk`, s.tg)).body.lesson.language, 'ru');
});

test('18+ с согласием: попытки и прогресс пишутся, повтор request_id — без дубля', opts, async () => {
  const s = await student();
  const first = await answer(s.tg, pyId, 's1', 0, { request_id: `dup-${run}` });
  assert.equal(first.body.saved, true);
  assert.deepEqual(first.body.progress.completed, ['s1']);
  assert.equal(first.body.progress.current_step, 's2');
  assert.equal(first.body.progress.steps_total, 4);
  await answer(s.tg, pyId, 's1', 0, { request_id: `dup-${run}` });
  assert.equal(await attemptsOf(s.id), 1);

  const wrong = await answer(s.tg, pyId, 's2', 0, { hints_used: 2 });
  assert.equal(wrong.body.correct, false);
  assert.match(wrong.body.feedback, /1000 не больше 1000/);
  assert.equal(wrong.body.progress.completed_steps, 1);
  const [{ hints }] = await db()<{ hints: number }[]>`select hints_used as hints from attempts where user_id = ${s.id} and step_id = 's2'`;
  assert.equal(hints, 2);

  const list = await call('GET', '/api/lessons', s.tg);
  const py = list.body.lessons.find((l: any) => l.id === pyId);
  assert.deepEqual(py.progress, { completed_steps: 1, current_step: 's2', completed_at: null, hints_used: 2, first_try: null, medal: null });
});

test('весь урок: самостоятельная своего варианта с первой попытки → completed_at', opts, async () => {
  const s = await student();
  let last: any;
  for (const st of stepsOf(math)) last = await answer(s.tg, mathId, st.id, rightAnswer(st, s.id, mathId));
  assert.equal(last.body.correct, true);
  assert.equal(last.body.progress.completed_steps, 4);
  assert.equal(last.body.progress.current_step, null);
  assert.ok(last.body.progress.completed_at);
  assert.deepEqual(last.body.progress.independent, { solved: true, first_try: true });

  const got = await call('GET', `/api/lessons/${mathId}`, s.tg);
  assert.equal(got.body.progress.completed_steps, 4);
});

test('значок и серия: всё с первой попытки без подсказок — золото; с подсказкой — серебро; серия 1, сегодня', opts, async () => {
  const gold = await student();
  for (const st of stepsOf(math)) await answer(gold.tg, mathId, st.id, rightAnswer(st, gold.id, mathId));
  const lg = await call('GET', '/api/lessons', gold.tg);
  const pg = lg.body.lessons.find((l: any) => l.id === mathId).progress;
  assert.equal(pg.medal, 'gold');
  assert.equal(pg.hints_used, 0);
  assert.equal(pg.first_try, true);
  assert.deepEqual(lg.body.stats, { streak_days: 1, active_today: true });

  const silver = await student();
  const steps = stepsOf(math);
  for (const st of steps) {
    await answer(silver.tg, mathId, st.id, rightAnswer(st, silver.id, mathId), { hints_used: st.independent ? 0 : 2 });
  }
  const one = await call('GET', `/api/lessons/${mathId}`, silver.tg);
  assert.equal(one.body.progress.medal, 'silver');
  assert.equal(one.body.progress.hints_used, 2 * steps.filter((x) => !x.independent).length);

  const fresh = await student();
  const lf = await call('GET', '/api/lessons', fresh.tg);
  assert.deepEqual(lf.body.stats, { streak_days: 0, active_today: false });
  assert.equal(lf.body.lessons.find((l: any) => l.id === mathId).progress, null);
});

test('серия по датам Казахстана: вчера и сегодня — 2 дня; демо — без серии', opts, async () => {
  const s = await student();
  await answer(s.tg, pyId, 's1', 0);
  // одна попытка «вчера» по Алматы
  await db()`update attempts set created_at = now() - interval '1 day' where id = (select id from attempts where user_id = ${s.id} limit 1)`;
  await answer(s.tg, pyId, 's2', 1);
  const l = await call('GET', '/api/lessons', s.tg);
  assert.deepEqual(l.body.stats, { streak_days: 2, active_today: true });
  const demo = await call('GET', '/api/lessons', ++nextTg);
  assert.equal(demo.body.stats, null);
});

test('самостоятельная: ответ чужого варианта не засчитывается, first_try = false', opts, async () => {
  const s = await student();
  const s4 = stepsOf(python).find((x) => x.id === 's4')!;
  const mine = variantIndex(s.id, pyId, s4);
  const r = await answer(s.tg, pyId, 's4', answerFor(s4, (mine + 1) % 3)); // ответ соседнего варианта
  assert.equal(r.body.correct, false);
  assert.deepEqual(r.body.progress.independent, { solved: false, first_try: false });
  const ok = await answer(s.tg, pyId, 's4', rightAnswer(s4, s.id, pyId));
  assert.deepEqual(ok.body.progress.independent, { solved: true, first_try: false });
});

test('младше 18 без согласия родителя: проверка есть, попытки не пишем', opts, async () => {
  const s = await student({ date: '2012-03-03' });
  const r = await answer(s.tg, pyId, 's1', 0);
  assert.equal(r.body.correct, true);
  assert.equal(r.body.saved, false);
  assert.equal(r.body.progress, null);
  assert.equal(await attemptsOf(s.id), 0);
  assert.equal((await call('GET', '/api/lessons', s.tg)).body.can_save_progress, false);
});

test('checks и free_input — только после верного ответа: в ответе reveal и потом в уроке', opts, async () => {
  const s = await student();
  const wrong = await answer(s.tg, pyId, 's3', 0);
  assert.equal(wrong.body.correct, false);
  assert.equal(wrong.body.reveal, undefined);
  const ok = await answer(s.tg, pyId, 's3', 1);
  assert.ok(Array.isArray(ok.body.reveal.checks));
  assert.ok(Array.isArray(ok.body.reveal.free_input));
  assert.equal(ok.body.reveal.free_input[0].solution, undefined);
  const lesson = (await call('GET', `/api/lessons/${pyId}`, s.tg)).body.lesson;
  const s3 = lesson.steps.find((x: any) => x.id === 's3');
  assert.ok(Array.isArray(s3.checks) && Array.isArray(s3.free_input));
  assert.equal(lesson.steps.find((x: any) => x.id === 's2').free_input, undefined);
  // демо тоже получает reveal после верного ответа (ничего не пишем)
  assert.ok(Array.isArray((await answer(++nextTg, pyId, 's3', 1)).body.reveal.checks));
});

test('повтор request_id: тот же ответ — прежний результат; другой ответ или урок — 409, не 500', opts, async () => {
  const s = await student();
  const id = `same-${run}`;
  const first = await answer(s.tg, pyId, 's1', 0, { request_id: id });
  assert.equal(first.body.correct, true);
  const again = await answer(s.tg, pyId, 's1', 0, { request_id: id });
  assert.equal(again.status, 200);
  assert.equal(again.body.correct, true);
  assert.equal(again.body.progress.completed_steps, 1);
  assert.equal((await answer(s.tg, pyId, 's1', 1, { request_id: id })).status, 409);
  assert.equal((await answer(s.tg, mathId, 's1', 1, { request_id: id })).status, 409);
  assert.equal(await attemptsOf(s.id), 1);
});

test('заведённый без согласий: самостоятельную не оцениваем (нельзя перебрать до согласия)', opts, async () => {
  const s = await student({ date: '2012-03-03' });
  const s4 = stepsOf(python).find((x) => x.id === 's4')!;
  const r = await answer(s.tg, pyId, 's4', rightAnswer(s4, s.id, pyId));
  assert.equal(r.status, 200);
  assert.equal(r.body.correct, null);
  assert.equal(r.body.saved, false);
  assert.match(r.body.feedback, /когда включится сохранение/);
  // демо (Telegram не заведён) — проверяем как обычно
  const tg = ++nextTg;
  assert.equal(typeof (await answer(tg, pyId, 's4', rightAnswer(s4, `tg:${tg}`, pyId))).body.correct, 'boolean');
});

test('порядок уроков — по плану: неделя, номер в неделе', opts, async () => {
  const later = await lesson('python', { ...python, slug: `aa-later-${run}`, week: 3, order: 1 }, true);
  const earlier = await lesson('python', { ...python, slug: `zz-earlier-${run}`, week: 1, order: 2 }, true);
  const s = await student();
  const list = (await call('GET', '/api/lessons', s.tg)).body.lessons;
  const ids = list.map((l: any) => l.id);
  assert.ok(ids.indexOf(earlier) < ids.indexOf(later));
  const e = list.find((l: any) => l.id === earlier);
  assert.equal(e.week, 1);
  assert.equal(e.order, 2);
  // числами, а не строками: неделя 9 раньше недели 10
  const w10 = await lesson('python', { ...python, slug: `aa-w10-${run}`, week: 10, order: 1 }, true);
  const w9 = await lesson('python', { ...python, slug: `zz-w9-${run}`, week: 9, order: 1 }, true);
  const ids2 = (await call('GET', '/api/lessons', s.tg)).body.lessons.map((l: any) => l.id);
  assert.ok(ids2.indexOf(w9) < ids2.indexOf(w10));
});

test('без согласия на ПД (18+): не пишем', opts, async () => {
  const s = await student({ consent: false });
  assert.equal((await answer(s.tg, pyId, 's1', 0)).body.saved, false);
  assert.equal(await attemptsOf(s.id), 0);
});

test('плохие запросы: request_id, шаг, формат ответа, урок', opts, async () => {
  const s = await student();
  assert.equal((await answer(s.tg, pyId, 's1', 0, { request_id: 'x' })).status, 400);
  assert.equal((await answer(s.tg, pyId, 'nope', 0)).body.error, 'step_not_found');
  assert.equal((await answer(s.tg, pyId, 's1', 'один')).body.error, 'bad_answer');
  assert.equal((await answer(s.tg, pyId, 's4', 1)).body.error, 'bad_answer');
  assert.equal((await answer(s.tg, hiddenId, 's1', 0)).status, 404);
  assert.equal(await attemptsOf(s.id), 0);
});

test('куратор: видит неопубликованные и прогресс своей группы; чужой — 404', opts, async () => {
  const s = await student();
  await answer(s.tg, pyId, 's1', 0);
  await answer(s.tg, pyId, 's2', 0, { hints_used: 1 });

  assert.ok((await call('GET', '/api/lessons', curatorTg)).body.lessons.some((l: any) => l.id === hiddenId && l.is_published === false));

  const p = await call('GET', `/api/curator/progress?group_id=${groupId}`, curatorTg);
  assert.equal(p.status, 200);
  assert.ok(p.body.lessons.some((l: any) => l.id === pyId && l.steps_total === 4));
  const row = p.body.students.find((x: any) => x.id === s.id);
  assert.equal(row.can_save_progress, true);
  assert.deepEqual(
    { ...row.lessons[pyId], last_activity: undefined },
    { completed_steps: 1, current_step: 's2', completed_at: null, last_activity: undefined, attempts: 2, hints_used: 1,
      independent: { solved: false, first_try: null } },
  );
  // в ответе куратору — никаких ответов студента
  assert.ok(!JSON.stringify(p.body).includes('"answer"'));

  assert.equal((await call('GET', `/api/curator/progress?group_id=${groupId}`, s.tg)).status, 403);
  const [{ id: otherGroup }] = await db()<{ id: string }[]>`insert into groups (title) values ('Чужая') returning id`;
  assert.equal((await call('GET', `/api/curator/progress?group_id=${otherGroup}`, curatorTg)).status, 404);
});
