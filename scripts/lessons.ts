// Уроки из content/: чтение, проверка по content/lesson.schema.json и совпадение ru ↔ kk.
// Без базы — чтобы проверять в CI на каждом PR и покрыть тестами. Запись в базу — sync-lessons.ts.
//
// Файлы (003_lesson_languages.sql):
//   <subject>/<slug>.json     — основной язык (ru): структура + тексты + эталоны → lessons.content
//   <subject>/<slug>.kk.json  — перевод (kk), тот же slug → lesson_translations
// Перевод принимается, только если «нетекстовые» поля совпадают с основным файлом (правила в 003).

import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';

export type Json = null | boolean | number | string | Json[] | { [k: string]: Json };
export type Obj = { [k: string]: Json };

export interface LessonFile {
  path: string; // относительно content/
  subject: string;
  slug: string;
  language: 'ru' | 'kk';
  content: Obj;
}

export interface LessonPair {
  base: LessonFile;
  translations: LessonFile[];
}

const SUBJECTS = ['python', 'math'];
const STATUSES = ['draft', 'review', 'approved'];
const ANSWER_TYPES = ['choice', 'number', 'formula', 'text', 'code'];
const FREE_TYPES = ['number', 'formula', 'text', 'code'];
const SLUG = /^[0-9]{2}-[a-z0-9-]+$/;

const isObj = (v: unknown): v is Obj => typeof v === 'object' && v !== null && !Array.isArray(v);
const isStr = (v: unknown): v is string => typeof v === 'string' && v.trim() !== '';
const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const isStrArr = (v: unknown) => Array.isArray(v) && v.every((x) => typeof x === 'string');

function checkNumberExpected(v: unknown, at: string, errors: string[]) {
  if (!isObj(v) || !isNum(v.value) || !isNum(v.tolerance) || (v.tolerance as number) < 0) {
    errors.push(`${at}: нужен { value: число, tolerance: число ≥ 0 }`);
  }
}

function checkTests(v: unknown, at: string, errors: string[]) {
  if (!Array.isArray(v)) return errors.push(`${at}: должен быть массив`);
  v.forEach((t, i) => {
    if (!isObj(t) || !isStr(t.call) || !('expect' in t)) errors.push(`${at}[${i}]: нужны call и expect`);
  });
}

// ── Лаборатория шага: студент меняет вариант и вводит свои значения, программа считает ──
// threshold — «если x ОП порог: x × коэффициент, иначе x»; ОП — выбранный вариант (>, >=, <, <=, ==, !=).
// chain — цепочка if / elif / else: orders[номер варианта] = [[порог, итог], …], условие x >= порог, иначе else.
// Ответов лаборатория не показывает — только что посчитала программа студента; при верном варианте
// она обязана выдавать ровно checks шага (проверяем ниже), иначе урок с ошибкой.
const LAB_OPS = ['>', '>=', '<', '<=', '==', '!='];

export function labResult(lab: Obj, option: number, options: string[], x: number): number | string | null {
  if (lab.kind === 'threshold') {
    const op = options[option];
    const t = lab.threshold as number;
    const hit = op === '>' ? x > t : op === '>=' ? x >= t : op === '<' ? x < t : op === '<=' ? x <= t : op === '==' ? x === t : op === '!=' ? x !== t : null;
    if (hit === null) return null;
    return hit ? Math.round(x * (lab.then_factor as number) * 100) / 100 : x;
  }
  if (lab.kind === 'chain') {
    const order = (lab.orders as [number, string][][])[option];
    if (!order) return null;
    for (const [t, label] of order) if (x >= t) return label;
    return lab.else as string;
  }
  return null;
}

function checkLab(s: Obj, at: string, errors: string[]) {
  const lab = s.lab;
  const la = `${at}.lab`;
  if (!isObj(lab)) return void errors.push(`${la}: объект`);
  if (s.independent === true) errors.push(`${la}: в самостоятельной задаче лаборатории нет — она подсказывает ответ`);
  if (s.answer_type !== 'choice' || !isStrArr(s.options)) return void errors.push(`${la}: только у шага choice с options`);
  for (const k of ['title', 'label']) if (!isStr(lab[k])) errors.push(`${la}.${k}: непустая строка`);
  if (!(Array.isArray(lab.presets) && lab.presets.length >= 1 && lab.presets.length <= 10 && lab.presets.every(isNum))) {
    errors.push(`${la}.presets: от 1 до 10 чисел`);
  }
  const options = s.options as string[];
  if (lab.kind === 'threshold') {
    if (!isNum(lab.threshold) || !isNum(lab.then_factor)) errors.push(`${la}: нужны числа threshold и then_factor`);
    if ('unit' in lab && typeof lab.unit !== 'string') errors.push(`${la}.unit: строка`);
    const bad = options.filter((o) => !LAB_OPS.includes(o));
    if (bad.length) errors.push(`${la}: варианты шага должны быть знаками сравнения (${LAB_OPS.join(' ')}), а не «${bad.join('», «')}»`);
  } else if (lab.kind === 'chain') {
    const orders = lab.orders;
    const okOrder = (o: unknown) => Array.isArray(o) && o.length > 0 && o.every((b) => Array.isArray(b) && b.length === 2 && isNum(b[0]) && isStr(b[1]));
    if (!(Array.isArray(orders) && orders.length === options.length && orders.every(okOrder))) {
      errors.push(`${la}.orders: по одному порядку [[порог, итог], …] на каждый вариант ответа (${options.length})`);
    }
    if (!isStr(lab.else)) errors.push(`${la}.else: непустая строка`);
  } else {
    return void errors.push(`${la}.kind: threshold или chain`);
  }
  // Верный вариант в лаборатории даёт ровно то, что в checks
  if (errors.some((e) => e.startsWith(la)) || !Array.isArray(s.checks) || !Number.isInteger(s.expected)) return;
  for (const c of s.checks as Obj[]) {
    if (!isNum(c.input)) continue;
    const got = labResult(lab, s.expected as number, options, c.input);
    if (got !== c.expect) errors.push(`${la}: при верном варианте и ${c.input} лаборатория даёт ${JSON.stringify(got)}, а в checks ${JSON.stringify(c.expect)}`);
  }
}

// Проверка по lesson.schema.json (то, что в ней сказано) + смысл: индекс ответа в пределах вариантов,
// у самостоятельной задачи нет подсказок, id шагов не повторяются.
export function validateLesson(c: unknown): string[] {
  const errors: string[] = [];
  if (!isObj(c)) return ['урок должен быть объектом'];
  for (const k of ['subject', 'slug', 'title', 'skill', 'minutes', 'story', 'steps', 'status']) {
    if (!(k in c)) errors.push(`нет обязательного поля ${k}`);
  }
  if ('subject' in c && !SUBJECTS.includes(c.subject as string)) errors.push(`subject: одно из ${SUBJECTS.join(', ')}`);
  if ('slug' in c && !(typeof c.slug === 'string' && SLUG.test(c.slug))) errors.push('slug: формат 01-latinica-cherez-defis');
  for (const k of ['title', 'skill', 'story']) if (k in c && !isStr(c[k])) errors.push(`${k}: непустая строка`);
  if ('minutes' in c && !(Number.isInteger(c.minutes) && (c.minutes as number) >= 1)) errors.push('minutes: целое ≥ 1');
  for (const k of ['week', 'order']) if (k in c && !(Number.isInteger(c[k]) && (c[k] as number) >= 1)) errors.push(`${k}: целое ≥ 1`);
  if ('language' in c && c.language !== 'ru' && c.language !== 'kk') errors.push('language: ru или kk');
  if ('status' in c && !STATUSES.includes(c.status as string)) errors.push(`status: одно из ${STATUSES.join(', ')}`);
  for (const k of ['approved_by', 'material', 'variable']) if (k in c && typeof c[k] !== 'string') errors.push(`${k}: строка`);

  const steps = c.steps;
  if ('steps' in c && (!Array.isArray(steps) || steps.length === 0)) errors.push('steps: хотя бы один шаг');
  const ids = new Set<string>();
  (Array.isArray(steps) ? steps : []).forEach((s, i) => {
    const at = `steps[${i}]`;
    if (!isObj(s)) return errors.push(`${at}: объект`);
    for (const k of ['id', 'title', 'prompt', 'answer_type', 'hints']) if (!(k in s)) errors.push(`${at}: нет поля ${k}`);
    if ('id' in s) {
      if (!isStr(s.id)) errors.push(`${at}.id: строка`);
      else if (ids.has(s.id)) errors.push(`${at}.id: «${s.id}» повторяется`);
      else ids.add(s.id);
    }
    for (const k of ['title', 'prompt']) if (k in s && !isStr(s[k])) errors.push(`${at}.${k}: непустая строка`);
    const type = s.answer_type as string;
    if ('answer_type' in s && !ANSWER_TYPES.includes(type)) errors.push(`${at}.answer_type: одно из ${ANSWER_TYPES.join(', ')}`);
    if ('independent' in s && typeof s.independent !== 'boolean') errors.push(`${at}.independent: true / false`);
    if ('options' in s && !isStrArr(s.options)) errors.push(`${at}.options: массив строк`);
    if ('hints' in s) {
      if (!isStrArr(s.hints)) errors.push(`${at}.hints: массив строк`);
      else if ((s.hints as string[]).length > 3) errors.push(`${at}.hints: не больше 3 (намёк, вопрос, пример)`);
      else if (s.independent === true && (s.hints as string[]).length > 0) errors.push(`${at}.hints: у самостоятельной задачи подсказок нет`);
    }
    for (const k of ['starter_code', 'solution', 'simple', 'code']) if (k in s && typeof s[k] !== 'string') errors.push(`${at}.${k}: строка`);
    const nOpt = Array.isArray(s.options) ? s.options.length : 0;
    if (type === 'choice') {
      if (nOpt < 2) errors.push(`${at}.options: для choice нужно хотя бы 2 варианта`);
      if (!(Number.isInteger(s.expected) && (s.expected as number) >= 0 && (s.expected as number) < nOpt)) {
        errors.push(`${at}.expected: индекс верного варианта (0…${Math.max(nOpt - 1, 0)})`);
      }
    }
    if (type === 'number') checkNumberExpected(s.expected, `${at}.expected`, errors);
    if (type === 'code' && 'tests' in s) checkTests(s.tests, `${at}.tests`, errors);
    if ('tests' in s && type !== 'code') checkTests(s.tests, `${at}.tests`, errors);
    if ('common_mistakes' in s) {
      if (!Array.isArray(s.common_mistakes)) errors.push(`${at}.common_mistakes: массив`);
      else s.common_mistakes.forEach((m, j) => {
        if (!isObj(m) || typeof m.pattern !== 'string' || !isStr(m.feedback)) errors.push(`${at}.common_mistakes[${j}]: нужны pattern и feedback`);
      });
    }
    if ('checks' in s) {
      if (!Array.isArray(s.checks)) errors.push(`${at}.checks: массив`);
      else s.checks.forEach((ch, j) => { if (!isObj(ch) || !('input' in ch) || !('expect' in ch)) errors.push(`${at}.checks[${j}]: нужны input и expect`); });
    }
    if ('number_part' in s) {
      const np = s.number_part;
      if (!isObj(np) || !isStr(np.label)) errors.push(`${at}.number_part: нужен label`);
      if (isObj(np)) checkNumberExpected(np.expected, `${at}.number_part.expected`, errors);
    }
    if ('variants' in s) {
      if (!Array.isArray(s.variants)) errors.push(`${at}.variants: массив`);
      else s.variants.forEach((v, j) => {
        const vat = `${at}.variants[${j}]`;
        if (!isObj(v)) return errors.push(`${vat}: объект`);
        const extra = Object.keys(v).filter((k) => !['prompt', 'options', 'expected', 'number_part', 'tests'].includes(k));
        if (extra.length) errors.push(`${vat}: лишние поля ${extra.join(', ')}`);
        if (!isStr(v.prompt)) errors.push(`${vat}.prompt: непустая строка`);
        if ('options' in v && !isStrArr(v.options)) errors.push(`${vat}.options: массив строк`);
        if (type === 'choice' && !(Number.isInteger(v.expected) && (v.expected as number) >= 0 && (v.expected as number) < (Array.isArray(v.options) ? v.options.length : nOpt))) {
          errors.push(`${vat}.expected: индекс верного варианта`);
        }
        if (type === 'number') checkNumberExpected(v.expected, `${vat}.expected`, errors);
        if ('number_part' in v && isObj(v.number_part)) checkNumberExpected(v.number_part.expected, `${vat}.number_part.expected`, errors);
        if ('tests' in v) checkTests(v.tests, `${vat}.tests`, errors);
      });
    }
    if ('lab' in s) checkLab(s, at, errors);
    if ('free_input' in s) {
      if (!Array.isArray(s.free_input)) errors.push(`${at}.free_input: массив`);
      else s.free_input.forEach((f, j) => {
        const fat = `${at}.free_input[${j}]`;
        if (!isObj(f) || !isStr(f.prompt)) return errors.push(`${fat}: нужен prompt`);
        if (!FREE_TYPES.includes(f.answer_type as string)) errors.push(`${fat}.answer_type: одно из ${FREE_TYPES.join(', ')}`);
        if ('tests' in f && !Array.isArray(f.tests)) errors.push(`${fat}.tests: массив`);
      });
    }
  });
  return errors;
}

// «Скелет» урока — всё, что в переводе обязано совпадать с основным файлом (003)
export function structureOf(c: Obj): Json {
  const steps = (Array.isArray(c.steps) ? c.steps : []) as Obj[];
  return {
    subject: c.subject ?? null,
    slug: c.slug ?? null,
    steps: steps.map((s) => ({
      id: s.id ?? null,
      answer_type: s.answer_type ?? null,
      independent: s.independent ?? false,
      expected: s.expected ?? null,
      tests: s.tests ?? null,
      checks: s.checks ?? null,
      number_part_expected: isObj(s.number_part) ? (s.number_part.expected ?? null) : null,
      options: Array.isArray(s.options) ? s.options.length : 0,
      hints: Array.isArray(s.hints) ? s.hints.length : 0,
      variants: Array.isArray(s.variants)
        ? (s.variants as Obj[]).map((v) => ({
            expected: v.expected ?? null,
            number_part_expected: isObj(v.number_part) ? (v.number_part.expected ?? null) : null,
          }))
        : null,
      free_input: Array.isArray(s.free_input)
        ? (s.free_input as Obj[]).map((f) => ({ answer_type: f.answer_type ?? null, expected: f.expected ?? null, tests: f.tests ?? null }))
        : null,
      common_mistakes: Array.isArray(s.common_mistakes) ? (s.common_mistakes as Obj[]).map((m) => m.pattern ?? null) : null,
      lab: isObj(s.lab)
        ? {
            kind: s.lab.kind ?? null,
            threshold: s.lab.threshold ?? null,
            then_factor: s.lab.then_factor ?? null,
            presets: s.lab.presets ?? null,
            orders: Array.isArray(s.lab.orders) ? (s.lab.orders as Json[][]).map((o) => (Array.isArray(o) ? o.map((b) => (Array.isArray(b) ? b[0] : null)) : null)) : null,
          }
        : null,
    })),
  };
}

// Где перевод расходится со скелетом основного файла: пути вида steps[2].expected
export function structureDiff(a: Json, b: Json, at = ''): string[] {
  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) return [`${at || '.'}: ${a.length} ≠ ${b.length}`];
    return a.flatMap((x, i) => structureDiff(x, b[i], `${at}[${i}]`));
  }
  if (isObj(a) && isObj(b)) {
    const keys = [...new Set([...Object.keys(a), ...Object.keys(b)])];
    return keys.flatMap((k) => structureDiff(a[k] ?? null, b[k] ?? null, at ? `${at}.${k}` : k));
  }
  return JSON.stringify(a) === JSON.stringify(b) ? [] : [at || '.'];
}

// content/plans/ — планы семестра (КТП), не уроки: их проверяет loadPlans
const PLANS_DIR = 'plans';

function walk(dir: string, top = true): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory()
      ? top && e.name === PLANS_DIR ? [] : walk(join(dir, e.name), false)
      : e.name.endsWith('.json') && e.name !== 'lesson.schema.json' ? [join(dir, e.name)] : [],
  );
}

export interface LoadResult {
  lessons: LessonPair[];
  errors: string[]; // «файл: что не так»
}

// Читает content/, проверяет каждый файл и пары ru ↔ kk. Ошибка в любом файле — повод не синхронизировать.
export function loadContent(root: string): LoadResult {
  const errors: string[] = [];
  const files: LessonFile[] = [];
  for (const full of walk(root).sort()) {
    const path = relative(root, full);
    let content: unknown;
    try {
      content = JSON.parse(readFileSync(full, 'utf8'));
    } catch (e) {
      errors.push(`${path}: не JSON (${(e as Error).message})`);
      continue;
    }
    const problems = validateLesson(content);
    if (problems.length) {
      errors.push(...problems.map((p) => `${path}: ${p}`));
      continue;
    }
    const c = content as Obj;
    const isKk = path.endsWith('.kk.json');
    const language = (c.language as 'ru' | 'kk' | undefined) ?? 'ru';
    if (isKk !== (language === 'kk')) {
      errors.push(`${path}: language «${language}» не совпадает с именем файла (${isKk ? '.kk.json' : '.json'})`);
      continue;
    }
    const folder = path.split(/[\\/]/)[0];
    if (folder !== c.subject) errors.push(`${path}: subject «${c.subject}», а файл в папке ${folder}/`);
    const fileSlug = path.split(/[\\/]/).pop()!.replace(/(\.kk)?\.json$/, '');
    if (fileSlug !== c.slug) errors.push(`${path}: slug «${c.slug}» не совпадает с именем файла «${fileSlug}»`);
    files.push({ path, subject: c.subject as string, slug: c.slug as string, language, content: c });
  }

  const key = (f: LessonFile) => `${f.subject}/${f.slug}`;
  const bases = new Map<string, LessonPair>();
  for (const f of files.filter((f) => f.language === 'ru')) {
    if (bases.has(key(f))) errors.push(`${f.path}: урок ${key(f)} уже есть в другом файле`);
    else bases.set(key(f), { base: f, translations: [] });
  }
  for (const t of files.filter((f) => f.language !== 'ru')) {
    const pair = bases.get(key(t));
    if (!pair) {
      errors.push(`${t.path}: нет основного файла ${key(t)}.json`);
      continue;
    }
    const diff = structureDiff(structureOf(pair.base.content), structureOf(t.content));
    if (diff.length) {
      errors.push(`${t.path}: структура не совпадает с ${pair.base.path} — ${diff.slice(0, 8).join(', ')}${diff.length > 8 ? '…' : ''}`);
      continue;
    }
    pair.translations.push(t);
  }
  return { lessons: [...bases.values()], errors };
}

// ── План семестра (КТП): content/plans/<slug>.json ────────────────────────────
// Недели по порядку, у каждой — тема, часы, «знать», «уметь», уроки сервиса (slug из content/<subject>/);
// необязательно — practice (практическая работа), project (шаг сквозного проекта, домашняя работа), review (какие прошлые
// недели повторяем), optional (углублённо / по выбору — вне рубежных контролей), hours_split (как делятся часы недели).
// Урок из плана должен существовать, а его week/order — совпадать с неделей и местом в плане:
// по ним приложение показывает уроки в порядке КТП.

export interface PlanFile {
  path: string;
  content: Obj;
}

export function validatePlan(c: unknown, lessons: LessonPair[]): string[] {
  const errors: string[] = [];
  if (!isObj(c)) return ['план должен быть объектом'];
  for (const k of ['subject', 'slug', 'title', 'semester', 'hours_total', 'weeks', 'status']) {
    if (!(k in c)) errors.push(`нет обязательного поля ${k}`);
  }
  if ('subject' in c && !SUBJECTS.includes(c.subject as string)) errors.push(`subject: одно из ${SUBJECTS.join(', ')}`);
  if ('status' in c && !STATUSES.includes(c.status as string)) errors.push(`status: одно из ${STATUSES.join(', ')}`);
  for (const k of ['semester', 'hours_total']) if (k in c && !(Number.isInteger(c[k]) && (c[k] as number) >= 1)) errors.push(`${k}: целое ≥ 1`);
  const weeks = c.weeks;
  if (!Array.isArray(weeks) || weeks.length === 0) return [...errors, 'weeks: хотя бы одна неделя'];

  const bySlug = new Map(lessons.filter((l) => l.base.subject === c.subject).map((l) => [l.base.slug, l.base.content]));
  const used = new Set<string>();
  let hours = 0;
  weeks.forEach((w, i) => {
    const at = `weeks[${i}]`;
    if (!isObj(w)) return errors.push(`${at}: объект`);
    if (w.week !== i + 1) errors.push(`${at}.week: ожидалась ${i + 1} — недели по порядку без пропусков`);
    if (!isStr(w.topic)) errors.push(`${at}.topic: непустая строка`);
    if (!(isNum(w.hours) && (w.hours as number) > 0)) errors.push(`${at}.hours: число > 0`);
    else hours += w.hours as number;
    for (const k of ['know', 'can']) if (!(Array.isArray(w[k]) && isStrArr(w[k]))) errors.push(`${at}.${k}: массив строк`);
    for (const k of ['practice', 'project', 'control', 'hours_split']) if (k in w && !isStr(w[k])) errors.push(`${at}.${k}: непустая строка`);
    if ('optional' in w && !(Array.isArray(w.optional) && isStrArr(w.optional))) errors.push(`${at}.optional: массив строк`);
    if ('review' in w && !(Array.isArray(w.review) && w.review.every((n) => Number.isInteger(n) && (n as number) >= 1 && (n as number) < (w.week as number)))) {
      errors.push(`${at}.review: номера прошлых недель (повторяем пройденное)`);
    }
    if (!(Array.isArray(w.lessons) && isStrArr(w.lessons))) return errors.push(`${at}.lessons: массив slug (может быть пустым)`);
    (w.lessons as string[]).forEach((slug, j) => {
      const l = bySlug.get(slug);
      if (!l) return errors.push(`${at}.lessons[${j}]: урока ${c.subject}/${slug} нет в content/`);
      if (used.has(slug)) errors.push(`${at}.lessons[${j}]: ${slug} уже есть в плане`);
      used.add(slug);
      if (l.week !== w.week || l.order !== j + 1) {
        errors.push(`${at}.lessons[${j}]: у урока ${slug} week/order = ${l.week ?? '—'}/${l.order ?? '—'}, а в плане ${w.week}/${j + 1}`);
      }
    });
  });
  if (isNum(c.hours_total) && hours !== c.hours_total) errors.push(`hours_total ${c.hours_total}, а сумма часов по неделям ${hours}`);
  for (const [slug, l] of bySlug) {
    if ('week' in l && !used.has(slug)) errors.push(`урок ${slug} с week = ${l.week} не стоит ни в одной неделе плана`);
  }
  return errors;
}

export function loadPlans(root: string, lessons: LessonPair[]): { plans: PlanFile[]; errors: string[] } {
  const dir = join(root, PLANS_DIR);
  let names: string[];
  try {
    names = readdirSync(dir).filter((n) => n.endsWith('.json')).sort();
  } catch {
    return { plans: [], errors: [] };
  }
  const plans: PlanFile[] = [];
  const errors: string[] = [];
  for (const n of names) {
    const path = `${PLANS_DIR}/${n}`;
    let content: unknown;
    try {
      content = JSON.parse(readFileSync(join(dir, n), 'utf8'));
    } catch (e) {
      errors.push(`${path}: не JSON (${(e as Error).message})`);
      continue;
    }
    const problems = validatePlan(content, lessons);
    if (isObj(content) && content.slug !== n.replace(/\.json$/, '')) problems.push(`slug «${content.slug}» не совпадает с именем файла`);
    if (problems.length) errors.push(...problems.map((p) => `${path}: ${p}`));
    else plans.push({ path, content: content as Obj });
  }
  return { plans, errors };
}
