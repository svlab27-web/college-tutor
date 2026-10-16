// Уроки для браузера и проверка ответа — без базы, чтобы покрыть тестами (docs/api.md, п. 2).
//
// В базе урок лежит целиком, вместе с эталонами (001: lessons.content). Наружу — только то,
// что видит студент: белый список полей ниже. Эталоны (expected, number_part.expected),
// решения, варианты самостоятельной задачи и шаблоны частых ошибок остаются на сервере.
// Минимум к показу 16.10: подсказки идут в уроке целиком (лестницу держит фронт);
// checks и free_input (код, формулы) — только после верного ответа на шаг, free_input без
// solution, проверяется в браузере и в прогресс не идёт.

import { createHash } from 'node:crypto';

type Obj = Record<string, unknown>;

const isObj = (v: unknown): v is Obj => typeof v === 'object' && v !== null && !Array.isArray(v);
const strings = (v: unknown): string[] | undefined =>
  Array.isArray(v) && v.every((x) => typeof x === 'string') ? (v as string[]) : undefined;

export type Lang = 'ru' | 'kk';

export interface NumberExpected {
  value: number;
  tolerance: number;
}

export interface Step {
  id: string;
  title: string;
  prompt: string;
  answer_type: string;
  independent?: boolean;
  options?: string[];
  expected?: unknown;
  hints?: string[];
  number_part?: { label: string; expected: NumberExpected };
  variants?: Obj[];
  common_mistakes?: { pattern: string; feedback: string }[];
  [key: string]: unknown;
}

export function stepsOf(content: Obj): Step[] {
  return (Array.isArray(content.steps) ? content.steps : []) as Step[];
}

// ── Вариант самостоятельной задачи ───────────────────────────
// 0 — основной текст шага, 1…n — variants. Выбирает сервер: один и тот же студент в одном
// уроке всегда получает один вариант (иначе можно было бы «перебрать» варианты).
export function variantIndex(seed: string, lessonId: string, step: Step): number {
  const count = 1 + (Array.isArray(step.variants) ? step.variants.length : 0);
  if (!step.independent || count === 1) return 0;
  const h = createHash('sha256').update(`${seed}:${lessonId}:${step.id}`).digest();
  return h.readUInt32BE(0) % count;
}

function variantOf(step: Step, index: number): Obj | null {
  return index > 0 && Array.isArray(step.variants) && isObj(step.variants[index - 1])
    ? (step.variants[index - 1] as Obj)
    : null;
}

// ── Урок для браузера ────────────────────────────────────────
const LESSON_FIELDS = ['subject', 'slug', 'title', 'skill', 'minutes', 'week', 'order', 'story', 'material'] as const;
const STEP_FIELDS = ['id', 'title', 'prompt', 'code', 'answer_type', 'options', 'hints', 'simple', 'independent'] as const;
const FREE_INPUT_FIELDS = ['prompt', 'answer_type', 'starter_code', 'tests', 'expected', 'label'] as const;

function pick(source: Obj, fields: readonly string[]): Obj {
  const out: Obj = {};
  for (const f of fields) if (source[f] !== undefined) out[f] = source[f];
  return out;
}

// Только после верного ответа на шаг: таблица проверки (checks) и задания «напиши код» (free_input).
// И то и другое выдаёт ответ шага: checks 999→999, 1000→900 однозначно дают «>», эталон free_input
// в математике s1 — ровно верная формула. Браузер проверяет free_input сам, но уже после того,
// как шаг засчитан. В самостоятельной free_input не отдаём вовсе (математика s4: эталон 450 —
// тот же ответ, что и у задачи).
export function afterSolved(step: Step): Obj {
  const out: Obj = {};
  if (Array.isArray(step.checks)) out.checks = step.checks;
  if (Array.isArray(step.free_input) && !step.independent) {
    out.free_input = step.free_input.filter(isObj).map((f) => pick(f, FREE_INPUT_FIELDS));
  }
  return out;
}

export function publicStep(step: Step, variant: number, solved = false): Obj {
  const out = pick(step, STEP_FIELDS);
  const v = variantOf(step, variant);
  if (v) {
    if (typeof v.prompt === 'string') out.prompt = v.prompt;
    if (strings(v.options)) out.options = v.options;
  }
  const np = (v && isObj(v.number_part) ? v.number_part : step.number_part) as Obj | undefined;
  if (isObj(np) && typeof np.label === 'string') out.number_part = { label: np.label };
  return solved ? { ...out, ...afterSolved(step) } : out;
}

export function publicLesson(content: Obj, variantFor: (step: Step) => number, solved: Set<string> = new Set()): Obj {
  return {
    ...pick(content, LESSON_FIELDS),
    steps: stepsOf(content).map((s) => publicStep(s, variantFor(s), solved.has(s.id))),
  };
}

// ── Числа в ответе ───────────────────────────────────────────
// Как в прототипе (app/index.html, number), строже: пробелы и неразрывные пробелы, типографский
// минус, единицы (₸, тг, м², кв.м, мм, см, м) — только в конце строки. Запятая в русской записи —
// десятичный знак («10,5», «0,125»). Тысячи через запятую — только «1,700,000» (две группы и больше,
// первая не с 0). Одиночное «1,500» неоднозначно (1,5 или 1500) — даём оба прочтения, засчитываем
// любое, что попало в допуск: верно и для денег, и для математики.
const num = (x: string): number[] => {
  if (x === '' || !/^[-+]?(\d+\.?\d*|\.\d+)(e[-+]?\d+)?$/i.test(x)) return [];
  const n = Number(x);
  return Number.isFinite(n) ? [n] : [];
};

export function parseNumbers(raw: unknown): number[] {
  if (typeof raw === 'number') return Number.isFinite(raw) ? [raw] : [];
  if (typeof raw !== 'string' || raw.length > 40) return [];
  const x = raw
    .replace(/[\s  ]/g, '')
    .replace(/[−–]/g, '-')
    .replace(/(₸|тг\.?|кв\.?м|м\^?2|м²|мм|см|м)$/i, '');
  if (/^[-+]?[1-9]\d{0,2}(,\d{3}){2,}(\.\d+)?$/.test(x)) return num(x.replace(/,/g, ''));
  if (/^[-+]?[1-9]\d{0,2},\d{3}$/.test(x)) return [...num(x.replace(',', '.')), ...num(x.replace(',', ''))];
  if (/^[-+]?\d*,\d+$/.test(x)) return num(x.replace(',', '.'));
  return num(x);
}

// Первое прочтение (для «1,500» — десятичное 1.5); NaN — не число
export function parseNumber(raw: unknown): number {
  return parseNumbers(raw)[0] ?? NaN;
}

function numberExpected(v: unknown): NumberExpected | null {
  return isObj(v) && typeof v.value === 'number' && typeof v.tolerance === 'number'
    ? { value: v.value, tolerance: v.tolerance }
    : null;
}

// Засчитываем, если в допуск попало любое прочтение числа (см. parseNumbers)
const close = (ns: number[], e: NumberExpected) => ns.some((n) => Math.abs(n - e.value) <= e.tolerance + 1e-9);

// ── Проверка ответа ──────────────────────────────────────────
const TEXT = {
  ru: {
    correct: 'Верно!',
    wrong: 'Пока не так. Возьмите подсказку — готовый ответ не дадим.',
    wrongIndependent: 'Пока не так. Вернитесь к материалам урока и попробуйте ещё раз.',
    notNumber: 'Введите число — например, 1700.',
    hidden: 'Ответ принят. Самостоятельную проверим, когда включится сохранение прогресса.',
  },
  kk: {
    correct: 'Дұрыс!',
    wrong: 'Әзірге дұрыс емес. Кеңесті алыңыз — дайын жауап берілмейді.',
    wrongIndependent: 'Әзірге дұрыс емес. Сабақ материалын қайта қарап, тағы байқап көріңіз.',
    notNumber: 'Санды енгізіңіз — мысалы, 1700.',
    hidden: 'Жауап қабылданды. Өзіндік тапсырманы прогресс сақтала бастағанда тексереміз.',
  },
};

export function hiddenFeedback(lang: Lang): string {
  return TEXT[lang].hidden;
}

export class BadAnswer extends Error {}
export class BrowserCheck extends Error {}

export interface CheckResult {
  correct: boolean;
  parts?: Record<string, boolean>;
  feedback: string;
  stored: Obj; // что пишем в attempts.answer — только нужные поля, не тело запроса целиком
}

const clip = (v: unknown) => (typeof v === 'number' ? v : String(v ?? '').slice(0, 40));

function choiceIndex(raw: unknown, options: number): number {
  if (typeof raw !== 'number' || !Number.isInteger(raw) || raw < 0 || raw >= options) {
    throw new BadAnswer('choice');
  }
  return raw;
}

function mistake(step: Step, key: string): string | undefined {
  return (Array.isArray(step.common_mistakes) ? step.common_mistakes : []).find(
    (m) => isObj(m) && m.pattern === key && typeof m.feedback === 'string',
  )?.feedback;
}

// answer: choice — индекс; number — строка или число; choice + number_part — { choice, number };
// number + number_part — { number, part }.
export function checkAnswer(step: Step, variant: number, answer: unknown, lang: Lang): CheckResult {
  const t = TEXT[lang];
  const v = variantOf(step, variant);
  const wrong = step.independent ? t.wrongIndependent : t.wrong;
  const np = (v && isObj(v.number_part) ? v.number_part : step.number_part) as Obj | undefined;
  const npExpected = isObj(np) ? numberExpected(np.expected) : null;

  if (step.answer_type === 'choice') {
    const options = strings(v?.options) ?? step.options ?? [];
    const expected = v && v.expected !== undefined ? v.expected : step.expected;
    if (npExpected) {
      if (!isObj(answer)) throw new BadAnswer('choice+number');
      const index = choiceIndex(answer.choice, options.length);
      const choice = index === expected;
      const n = parseNumbers(answer.number);
      const number = close(n, npExpected);
      const correct = choice && number;
      const feedback = correct
        ? t.correct
        : (!choice && mistake(step, String(index))) || (!n.length ? t.notNumber : wrong);
      return { correct, parts: { choice, number }, feedback, stored: { choice: index, number: clip(answer.number) } };
    }
    const index = choiceIndex(answer, options.length);
    const correct = index === expected;
    return { correct, feedback: correct ? t.correct : mistake(step, String(index)) ?? wrong, stored: { choice: index } };
  }

  if (step.answer_type === 'number') {
    const expected = numberExpected(v && v.expected !== undefined ? v.expected : step.expected);
    if (!expected) throw new BrowserCheck(step.answer_type);
    if (npExpected) {
      if (!isObj(answer)) throw new BadAnswer('number+part');
      const n = parseNumbers(answer.number);
      const p = parseNumbers(answer.part);
      const number = close(n, expected);
      const part = close(p, npExpected);
      const correct = number && part;
      const feedback = correct
        ? t.correct
        : !n.length || !p.length
          ? t.notNumber
          : (!number && mistake(step, String(n[0]))) || wrong;
      return { correct, parts: { number, part }, feedback, stored: { number: clip(answer.number), part: clip(answer.part) } };
    }
    const n = parseNumbers(answer);
    const stored = { number: clip(answer) };
    if (!n.length) return { correct: false, feedback: t.notNumber, stored };
    const correct = close(n, expected);
    return { correct, feedback: correct ? t.correct : mistake(step, String(n[0])) ?? wrong, stored };
  }

  // formula / code / text — проверяет браузер (минимум к показу)
  throw new BrowserCheck(step.answer_type);
}

// ── Прогресс по урокам ───────────────────────────────────────
export interface IndependentFacts {
  solved: boolean;
  first_try: boolean | null; // null — ещё не пробовал
}

export interface LessonProgress {
  lesson_id: string;
  steps_total: number;
  completed_steps: number;
  completed: string[];
  current_step: string | null;
  completed_at: string | null;
  independent: IndependentFacts;
}

// Шаг пройден, когда на него есть верный ответ. Текущий — первый непройденный по порядку урока.
export function summarize(steps: Step[], solvedIds: Set<string>): { completed: string[]; current: string | null } {
  const completed = steps.filter((s) => solvedIds.has(s.id)).map((s) => s.id);
  const current = steps.find((s) => !solvedIds.has(s.id))?.id ?? null;
  return { completed, current };
}
