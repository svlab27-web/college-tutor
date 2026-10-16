// Проверка ответа и урок для браузера — на настоящих уроках из content/, без базы.

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { test } from 'node:test';
import {
  afterSolved,
  BadAnswer,
  BrowserCheck,
  checkAnswer,
  parseNumber,
  parseNumbers,
  publicLesson,
  stepsOf,
  summarize,
  variantIndex,
  type Step,
} from '../api/_lib/lessons';

const CONTENT = resolve(__dirname, '..', '..', 'content');
const load = (p: string) => JSON.parse(readFileSync(resolve(CONTENT, p), 'utf8')) as Record<string, unknown>;
const python = load('python/01-skidka-v-kafe.json');
const math = load('math/01-dvor-maks-ploshchadi.json');
const step = (lesson: Record<string, unknown>, id: string) => stepsOf(lesson).find((s) => s.id === id)!;
const steps = (pub: Record<string, unknown>) => pub.steps as Record<string, unknown>[];

// Шаг «число + вторая числовая часть» (как python/05 s4 в #49: аудитории и сколько в последней)
const rooms: Step = {
  id: 's4', title: 't', prompt: 'p', answer_type: 'number', independent: true, hints: [],
  expected: { value: 3, tolerance: 0 },
  number_part: { label: 'Сколько человек в последней аудитории', expected: { value: 5, tolerance: 0 } },
  variants: [{ prompt: 'v1', expected: { value: 5, tolerance: 0 }, number_part: { label: 'l1', expected: { value: 4, tolerance: 0 } } }],
};

test('числа: пробелы, ₸, м², запятая, тысячи, типографский минус; мусор — NaN', () => {
  assert.equal(parseNumber('1 700 ₸'), 1700);
  assert.equal(parseNumber('1 700тг'), 1700);
  assert.equal(parseNumber('10,5 м²'), 10.5);
  assert.equal(parseNumber('450 кв.м'), 450);
  assert.equal(parseNumber('1,700,000'), 1700000);
  assert.deepEqual(parseNumbers('1,700'), [1.7, 1700]); // одиночная группа — оба прочтения
  assert.deepEqual(parseNumbers('0,125'), [0.125]); // с 0 — только дробь
  assert.deepEqual(parseNumbers('0,001'), [0.001]);
  assert.deepEqual(parseNumbers('10,5'), [10.5]);
  assert.equal(parseNumber('1.700'), 1.7);
  assert.equal(parseNumber('−5'), -5);
  assert.equal(parseNumber(12), 12);
  assert.ok(Number.isNaN(parseNumber('м5м')), 'единицы — только в конце');
  assert.ok(Number.isNaN(parseNumber('')));
  assert.ok(Number.isNaN(parseNumber('десять')));
  assert.ok(Number.isNaN(parseNumber('1e999')));
  assert.ok(Number.isNaN(parseNumber({})));
  assert.ok(Number.isNaN(parseNumber('9'.repeat(50))));
});

test('choice: верно / частая ошибка / общий текст; в базу — только индекс; неверный формат — BadAnswer', () => {
  const s2 = step(python, 's2');
  assert.deepEqual(checkAnswer(s2, 0, 1, 'ru'), { correct: true, feedback: 'Верно!', stored: { choice: 1 } });
  const wrong = checkAnswer(s2, 0, 0, 'ru');
  assert.equal(wrong.correct, false);
  assert.match(wrong.feedback, /1000 не больше 1000/);
  assert.equal(checkAnswer(step(python, 's1'), 0, 2, 'ru').feedback, 'Пока не так. Возьмите подсказку — готовый ответ не дадим.');
  assert.throws(() => checkAnswer(s2, 0, 7, 'ru'), BadAnswer);
  assert.throws(() => checkAnswer(s2, 0, '1', 'ru'), BadAnswer);
  assert.throws(() => checkAnswer(s2, 0, 1.5, 'ru'), BadAnswer);
});

test('number с допуском и частой ошибкой; не число — подсказка; длинный ввод в базу обрезан', () => {
  const s3 = step(math, 's3');
  assert.equal(checkAnswer(s3, 0, '10', 'ru').correct, true);
  assert.equal(checkAnswer(s3, 0, '10,01', 'ru').correct, true);
  assert.equal(checkAnswer(s3, 0, '10,005', 'ru').correct, true); // «10,005» = 10.005 или 10005 — дробное в допуске
  assert.equal(checkAnswer(s3, 0, '10.5', 'ru').correct, false);
  assert.match(checkAnswer(s3, 0, '100', 'ru').feedback, /площадь/);
  const nan = checkAnswer(s3, 0, 'не знаю', 'ru');
  assert.equal(nan.correct, false);
  assert.match(nan.feedback, /Введите число/);
  assert.equal((checkAnswer(s3, 0, 'x'.repeat(5000), 'ru').stored.number as string).length, 40);
});

test('самостоятельная choice + number_part: обе части; ответ своего варианта, не чужого', () => {
  const s4 = step(python, 's4');
  const base = checkAnswer(s4, 0, { choice: 1, number: '1 700 ₸' }, 'ru');
  assert.deepEqual(base.parts, { choice: true, number: true });
  assert.equal(base.correct, true);
  assert.deepEqual(base.stored, { choice: 1, number: '1 700 ₸' });
  const half = checkAnswer(s4, 0, { choice: 1, number: '1500' }, 'ru');
  assert.deepEqual(half.parts, { choice: true, number: false });
  assert.match(half.feedback, /материалам урока/); // в самостоятельной подсказок нет
  assert.equal(checkAnswer(s4, 1, { choice: 1, number: '4700' }, 'ru').correct, true);
  assert.equal(checkAnswer(s4, 1, { choice: 1, number: '1700' }, 'ru').correct, false);
  assert.throws(() => checkAnswer(s4, 0, 1, 'ru'), BadAnswer);
});

test('number + number_part: { number, part }, обе части и варианты', () => {
  const ok = checkAnswer(rooms, 0, { number: '3', part: '5' }, 'ru');
  assert.deepEqual(ok.parts, { number: true, part: true });
  assert.equal(ok.correct, true);
  assert.deepEqual(ok.stored, { number: '3', part: '5' });
  const half = checkAnswer(rooms, 0, { number: '3', part: '21' }, 'ru');
  assert.deepEqual(half.parts, { number: true, part: false });
  assert.equal(half.correct, false);
  assert.match(checkAnswer(rooms, 0, { number: '3', part: 'пять' }, 'ru').feedback, /Введите число/);
  assert.equal(checkAnswer(rooms, 1, { number: 5, part: 4 }, 'ru').correct, true);
  assert.equal(checkAnswer(rooms, 1, { number: '3', part: '5' }, 'ru').correct, false);
  assert.throws(() => checkAnswer(rooms, 0, '3', 'ru'), BadAnswer);
});

test('«1,500» засчитывается и как деньги (1500), и как дробь (1,5); «0,125» — только дробь', () => {
  const money: Step = { id: 'm', title: 't', prompt: 'p', answer_type: 'number', expected: { value: 1500, tolerance: 0 } };
  const frac: Step = { id: 'f', title: 't', prompt: 'p', answer_type: 'number', expected: { value: 1.5, tolerance: 0 } };
  const small: Step = { id: 's', title: 't', prompt: 'p', answer_type: 'number', expected: { value: 0.125, tolerance: 0 } };
  assert.equal(checkAnswer(money, 0, '1,500', 'ru').correct, true);
  assert.equal(checkAnswer(frac, 0, '1,500', 'ru').correct, true);
  assert.equal(checkAnswer(small, 0, '0,125', 'ru').correct, true);
  assert.equal(checkAnswer(money, 0, '1,500,000', 'ru').correct, false);
  assert.equal(checkAnswer({ ...money, expected: { value: 1500000, tolerance: 0 } }, 0, '1,500,000', 'ru').correct, true);
});

test('formula / code — BrowserCheck', () => {
  const formula: Step = { id: 'f', title: 't', prompt: 'p', answer_type: 'formula', expected: 'x' };
  assert.throws(() => checkAnswer(formula, 0, 'x', 'ru'), BrowserCheck);
});

test('казахский текст ответа', () => {
  assert.equal(checkAnswer(step(python, 's2'), 0, 1, 'kk').feedback, 'Дұрыс!');
});

test('урок для браузера: эталонов, решений, вариантов, частых ошибок, checks и free_input нет', () => {
  for (const lesson of [python, math]) {
    const pub = publicLesson(lesson, () => 0);
    const text = JSON.stringify(pub);
    for (const key of ['"solution"', '"variants"', '"common_mistakes"', '"status"', '"approved_by"', '"checks"', '"free_input"']) {
      assert.ok(!text.includes(key), `${lesson.slug}: ${key} не должен уходить в браузер до ответа`);
    }
    for (const s of steps(pub)) {
      assert.equal(s.expected, undefined);
      if (s.number_part) assert.deepEqual(Object.keys(s.number_part as object), ['label']);
    }
  }
});

test('после верного ответа: checks и free_input шага (без solution); у самостоятельной free_input нет', () => {
  const pub = publicLesson(python, () => 0, new Set(['s3', 's4']));
  const s3 = steps(pub).find((s) => s.id === 's3')!;
  assert.ok(Array.isArray(s3.checks));
  assert.ok(Array.isArray(s3.free_input));
  assert.equal((s3.free_input as Record<string, unknown>[])[0].solution, undefined);
  const s4 = steps(pub).find((s) => s.id === 's4')!;
  assert.equal(s4.free_input, undefined);
  assert.equal(steps(pub).find((s) => s.id === 's1')!.checks, undefined);
  assert.deepEqual(Object.keys(afterSolved(step(math, 's4'))), []); // самостоятельная математики: 450 не уходит
});

test('самостоятельная: тексты выбранного варианта', () => {
  const pub = publicLesson(python, (s) => (s.independent ? 2 : 0));
  const s4 = steps(pub).find((s) => s.id === 's4')!;
  assert.match(s4.prompt as string, /Бонус 500/);
  assert.deepEqual(s4.number_part, { label: 'Бонус за покупку на 3 000 ₸, ₸' });
});

test('вариант стабилен для студента и урока, обычным шагам — 0', () => {
  const s4 = step(python, 's4');
  const a = variantIndex('user-1', 'lesson-1', s4);
  assert.equal(variantIndex('user-1', 'lesson-1', s4), a);
  assert.ok(a >= 0 && a <= 2);
  const seen = new Set(Array.from({ length: 40 }, (_, i) => variantIndex(`user-${i}`, 'lesson-1', s4)));
  assert.equal(seen.size, 3);
  assert.equal(variantIndex('user-1', 'lesson-1', step(python, 's1')), 0);
});

test('прогресс: пройденные по порядку урока, текущий — первый непройденный', () => {
  const all = stepsOf(python);
  assert.deepEqual(summarize(all, new Set()), { completed: [], current: 's1' });
  assert.deepEqual(summarize(all, new Set(['s2', 's1'])), { completed: ['s1', 's2'], current: 's3' });
  assert.deepEqual(summarize(all, new Set(['s1', 's3'])), { completed: ['s1', 's3'], current: 's2' });
  assert.deepEqual(summarize(all, new Set(['s1', 's2', 's3', 's4'])).current, null);
});
