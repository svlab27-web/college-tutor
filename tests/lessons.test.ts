// Проверка уроков без базы: настоящие файлы content/ проходят, испорченные — нет.

import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { test } from 'node:test';
import { labResult, loadContent, loadPlans, structureDiff, structureOf, validateLesson, validatePlan, type Obj } from '../scripts/lessons';

const CONTENT = resolve(__dirname, '..', '..', 'content');
const read = (p: string) => JSON.parse(readFileSync(join(CONTENT, p), 'utf8')) as Obj;

test('настоящие уроки из content/ проходят проверку, ru и kk совпадают', () => {
  const { lessons, errors } = loadContent(CONTENT);
  assert.deepEqual(errors, []);
  assert.ok(lessons.length >= 2);
  // Перевод kk — у уроков пилота обязателен, у новых уроков появляется позже (#15)
  for (const l of lessons) assert.ok(l.translations.length <= 1, `${l.base.path}: больше одного перевода`);
  for (const p of ['python/01-skidka-v-kafe.json', 'math/01-dvor-maks-ploshchadi.json']) {
    assert.equal(lessons.find((l) => l.base.path === p)?.translations.length, 1, `${p}: нет перевода kk`);
  }
});

test('план семестра из content/plans/ проходит проверку и не считается уроком', () => {
  const { lessons, errors } = loadContent(CONTENT);
  assert.deepEqual(errors, []);
  assert.ok(lessons.every((l) => !l.base.path.startsWith('plans')));
  const plans = loadPlans(CONTENT, lessons);
  assert.deepEqual(plans.errors, []);
  assert.equal(plans.plans.length, 1);
});

test('план: урока нет, week/order не совпадают, часы не сходятся, урок вне плана — ошибки', () => {
  const { lessons } = loadContent(CONTENT);
  const plan = read('plans/python-1-semestr.json');
  const weeks = plan.weeks as Obj[];
  weeks[0].lessons = ['03-peremennye-transportnaya-karta', '99-net-takogo']; // 02 выпал из плана, 03 сдвинулся на 1-е место
  weeks[1].hours = 5;
  weeks[2].week = 7;
  weeks[4].review = [5];
  const e = validatePlan(plan, lessons).join('\n');
  assert.match(e, /урока python\/99-net-takogo нет в content/);
  assert.match(e, /у урока 03-peremennye-transportnaya-karta week\/order = 1\/2, а в плане 1\/1/);
  assert.match(e, /hours_total 72, а сумма часов по неделям 73/);
  assert.match(e, /weeks\[2\]\.week: ожидалась 3/);
  assert.match(e, /weeks\[4\]\.review: номера прошлых недель/);
  assert.match(e, /урок 02-tablo-pervaya-programma с week = 1 не стоит ни в одной неделе плана/);
});

test('нет обязательных полей, неверный slug и индекс ответа — ошибки', () => {
  const c = read('python/01-skidka-v-kafe.json');
  delete c.story;
  c.slug = 'Skidka';
  ((c.steps as Obj[])[0]).expected = 7;
  const e = validateLesson(c).join('\n');
  assert.match(e, /нет обязательного поля story/);
  assert.match(e, /slug/);
  assert.match(e, /steps\[0\]\.expected: индекс/);
});

test('у самостоятельной задачи подсказок нет, подсказок не больше трёх, id не повторяются', () => {
  const c = read('python/01-skidka-v-kafe.json');
  const steps = c.steps as Obj[];
  const ind = steps.find((s) => s.independent === true)!;
  ind.hints = ['подсказка'];
  steps[0].hints = ['1', '2', '3', '4'];
  steps[1].id = steps[0].id;
  const e = validateLesson(c).join('\n');
  assert.match(e, /у самостоятельной задачи подсказок нет/);
  assert.match(e, /не больше 3/);
  assert.match(e, /повторяется/);
});

test('перевод с другим верным ответом или числом вариантов — не принимается', () => {
  const ru = read('math/01-dvor-maks-ploshchadi.json');
  const kk = read('math/01-dvor-maks-ploshchadi.kk.json');
  assert.deepEqual(structureDiff(structureOf(ru), structureOf(kk)), []);
  (kk.steps as Obj[])[0].expected = 2;
  ((kk.steps as Obj[])[1].options as string[]).pop();
  const diff = structureDiff(structureOf(ru), structureOf(kk));
  assert.ok(diff.includes('steps[0].expected'), diff.join());
  assert.ok(diff.includes('steps[1].options'), diff.join());
});

test('файлы: перевод без основного, language не по имени, ошибка структуры — в списке ошибок', () => {
  const dir = mkdtempSync(join(tmpdir(), 'lessons-'));
  mkdirSync(join(dir, 'python'));
  mkdirSync(join(dir, 'math'));
  const ru = read('python/01-skidka-v-kafe.json');
  const kk = read('python/01-skidka-v-kafe.kk.json');
  writeFileSync(join(dir, 'python', '01-skidka-v-kafe.json'), JSON.stringify(ru));
  (kk.steps as Obj[])[1].expected = 0; // шаг без лаборатории: у s3 расхождение с checks поймала бы уже проверка лаборатории
  writeFileSync(join(dir, 'python', '01-skidka-v-kafe.kk.json'), JSON.stringify(kk));
  writeFileSync(join(dir, 'math', '01-dvor-maks-ploshchadi.kk.json'), readFileSync(join(CONTENT, 'math/01-dvor-maks-ploshchadi.kk.json')));
  writeFileSync(join(dir, 'math', '02-oshibka.json'), '{ не json');
  const { errors } = loadContent(dir);
  const e = errors.join('\n');
  assert.match(e, /01-skidka-v-kafe\.kk\.json: структура не совпадает .* steps\[1\]\.expected/);
  assert.match(e, /нет основного файла math\/01-dvor-maks-ploshchadi\.json/);
  assert.match(e, /02-oshibka\.json: не JSON/);
});

test('лаборатория: при верном варианте совпадает с checks, ошибки в данных ловятся', () => {
  const c = read('python/01-skidka-v-kafe.json');
  const s3 = (c.steps as Obj[]).find((s) => s.id === 's3')!;
  const lab = s3.lab as Obj;
  const opts = s3.options as string[];
  // касса: «>=» — 1000 со скидкой, «>» — без; знаки сравнения считаются как в Python
  assert.equal(labResult(lab, opts.indexOf('>='), opts, 1000), 900);
  assert.equal(labResult(lab, opts.indexOf('>'), opts, 1000), 1000);
  assert.equal(labResult(lab, opts.indexOf('>='), opts, 1001), 900.9);
  assert.deepEqual(validateLesson(c), []);

  lab.threshold = 999; // порог разошёлся с checks
  assert.match(validateLesson(c).join('\n'), /при верном варианте и 999 лаборатория даёт 899\.1, а в checks 999/);
  lab.threshold = 1000;
  s3.options = ['больше', '>=', '<', '=='];
  assert.match(validateLesson(c).join('\n'), /варианты шага должны быть знаками сравнения/);

  const ind = (c.steps as Obj[]).find((s) => s.independent === true)!;
  ind.lab = { kind: 'threshold', title: 't', label: 'l', threshold: 1, then_factor: 1, presets: [1] };
  assert.match(validateLesson(c).join('\n'), /в самостоятельной задаче лаборатории нет/);
});

test('лаборатория chain: порядок условий; число порядков = числу вариантов', () => {
  const c = read('python/08-elif-ocenka-po-ballam.json');
  const s3 = (c.steps as Obj[]).find((s) => s.id === 's3')!;
  const lab = s3.lab as Obj;
  const opts = s3.options as string[];
  assert.equal(labResult(lab, 1, opts, 95), 'удовлетворительно'); // исходная ошибка урока: >= 50 первым
  assert.equal(labResult(lab, 0, opts, 95), 'отлично');
  assert.equal(labResult(lab, 0, opts, 49), 'неудовлетворительно');
  (lab.orders as unknown[]).pop();
  assert.match(validateLesson(c).join('\n'), /orders: по одному порядку/);
});

test('лаборатория в переводе: числа те же, что в основном файле', () => {
  const ru = read('python/01-skidka-v-kafe.json');
  const kk = read('python/01-skidka-v-kafe.kk.json');
  assert.deepEqual(structureDiff(structureOf(ru), structureOf(kk)), []);
  (((kk.steps as Obj[]).find((s) => s.id === 's3')!).lab as Obj).threshold = 2000;
  assert.deepEqual(structureDiff(structureOf(ru), structureOf(kk)), ['steps[2].lab.threshold']);
});
