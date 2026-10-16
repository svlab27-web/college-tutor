// Проверка ответа и урок для браузера — на настоящих уроках из content/, без базы.

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { test } from 'node:test';
import {
  BadAnswer,
  BrowserCheck,
  checkAnswer,
  parseNumber,
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

test('числа: пробелы, ₸, м², запятая; мусор — NaN', () => {
  assert.equal(parseNumber('1 700 ₸'), 1700);
  assert.equal(parseNumber('1 700тг'), 1700);
  assert.equal(parseNumber('10,5 м²'), 10.5);
  assert.equal(parseNumber('450 кв.м'), 450);
  assert.equal(parseNumber(12), 12);
  assert.ok(Number.isNaN(parseNumber('')));
  assert.ok(Number.isNaN(parseNumber('десять')));
  assert.ok(Number.isNaN(parseNumber('1e999')));
  assert.ok(Number.isNaN(parseNumber({})));
  assert.ok(Number.isNaN(parseNumber('9'.repeat(50))));
});

test('choice: верно / частая ошибка / общий текст; неверный формат — BadAnswer', () => {
  const s2 = step(python, 's2');
  assert.deepEqual(checkAnswer(s2, 0, 1, 'ru'), { correct: true, feedback: 'Верно!' });
  const wrong = checkAnswer(s2, 0, 0, 'ru');
  assert.equal(wrong.correct, false);
  assert.match(wrong.feedback, /1000 не больше 1000/);
  assert.equal(checkAnswer(step(python, 's1'), 0, 2, 'ru').feedback, 'Пока не так. Возьмите подсказку — готовый ответ не дадим.');
  assert.throws(() => checkAnswer(s2, 0, 7, 'ru'), BadAnswer);
  assert.throws(() => checkAnswer(s2, 0, '1', 'ru'), BadAnswer);
  assert.throws(() => checkAnswer(s2, 0, 1.5, 'ru'), BadAnswer);
});

test('number с допуском и частой ошибкой; не число — подсказка, не исключение', () => {
  const s3 = step(math, 's3');
  assert.equal(checkAnswer(s3, 0, '10', 'ru').correct, true);
  assert.equal(checkAnswer(s3, 0, '10,005', 'ru').correct, true);
  assert.equal(checkAnswer(s3, 0, '10.5', 'ru').correct, false);
  assert.match(checkAnswer(s3, 0, '100', 'ru').feedback, /площадь/);
  const nan = checkAnswer(s3, 0, 'не знаю', 'ru');
  assert.equal(nan.correct, false);
  assert.match(nan.feedback, /Введите число/);
});

test('самостоятельная с number_part: обе части; ответ своего варианта, не чужого', () => {
  const s4 = step(python, 's4');
  const base = checkAnswer(s4, 0, { choice: 1, number: '1 700 ₸' }, 'ru');
  assert.deepEqual(base.parts, { choice: true, number: true });
  assert.equal(base.correct, true);
  const half = checkAnswer(s4, 0, { choice: 1, number: '1500' }, 'ru');
  assert.deepEqual(half.parts, { choice: true, number: false });
  assert.match(half.feedback, /материалам урока/); // в самостоятельной подсказок нет
  // вариант 1: от 5 000, заказ 4 000 → 4 700
  assert.equal(checkAnswer(s4, 1, { choice: 1, number: '4700' }, 'ru').correct, true);
  assert.equal(checkAnswer(s4, 1, { choice: 1, number: '1700' }, 'ru').correct, false);
  assert.throws(() => checkAnswer(s4, 0, 1, 'ru'), BadAnswer);
});

test('formula / code — BrowserCheck', () => {
  const formula: Step = { id: 'f', title: 't', prompt: 'p', answer_type: 'formula', expected: 'x' };
  assert.throws(() => checkAnswer(formula, 0, 'x', 'ru'), BrowserCheck);
});

test('казахский текст ответа', () => {
  assert.equal(checkAnswer(step(python, 's2'), 0, 1, 'kk').feedback, 'Дұрыс!');
});

test('урок для браузера: эталонов, решений, вариантов и частых ошибок нет', () => {
  for (const lesson of [python, math]) {
    const pub = publicLesson(lesson, () => 0);
    const text = JSON.stringify(pub);
    for (const key of ['"solution"', '"variants"', '"common_mistakes"', '"status"', '"approved_by"']) {
      assert.ok(!text.includes(key), `${lesson.slug}: ${key} не должен уходить в браузер`);
    }
    for (const s of pub.steps as Record<string, unknown>[]) {
      assert.equal(s.expected, undefined);
      if (s.number_part) assert.deepEqual(Object.keys(s.number_part as object), ['label']);
      // самостоятельная — без free_input: там эталон совпадает с ответом задачи
      if (s.independent) assert.equal(s.free_input, undefined);
    }
  }
  // free_input остаётся (проверяет браузер), но без solution
  const s3 = (publicLesson(python, () => 0).steps as Record<string, unknown>[]).find((s) => s.id === 's3')!;
  assert.ok(Array.isArray(s3.free_input));
  assert.equal((s3.free_input as Record<string, unknown>[])[0].solution, undefined);
});

test('самостоятельная: тексты выбранного варианта', () => {
  const pub = publicLesson(python, (s) => (s.independent ? 2 : 0));
  const s4 = (pub.steps as Record<string, unknown>[]).find((s) => s.id === 's4')!;
  assert.match(s4.prompt as string, /Бонус 500/);
  assert.deepEqual(s4.number_part, { label: 'Бонус за покупку на 3 000 ₸, ₸' });
});

test('вариант стабилен для студента и урока, обычным шагам — 0', () => {
  const s4 = step(python, 's4');
  const a = variantIndex('user-1', 'lesson-1', s4);
  assert.equal(variantIndex('user-1', 'lesson-1', s4), a);
  assert.ok(a >= 0 && a <= 2);
  const seen = new Set(Array.from({ length: 40 }, (_, i) => variantIndex(`user-${i}`, 'lesson-1', s4)));
  assert.equal(seen.size, 3); // разным студентам — разные варианты
  assert.equal(variantIndex('user-1', 'lesson-1', step(python, 's1')), 0);
});

test('прогресс: пройденные по порядку урока, текущий — первый непройденный', () => {
  const steps = stepsOf(python);
  assert.deepEqual(summarize(steps, new Set()), { completed: [], current: 's1' });
  assert.deepEqual(summarize(steps, new Set(['s2', 's1'])), { completed: ['s1', 's2'], current: 's3' });
  assert.deepEqual(summarize(steps, new Set(['s1', 's3'])), { completed: ['s1', 's3'], current: 's2' });
  assert.deepEqual(summarize(steps, new Set(['s1', 's2', 's3', 's4'])).current, null);
});
