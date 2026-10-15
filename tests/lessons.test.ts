// Проверка уроков без базы: настоящие файлы content/ проходят, испорченные — нет.

import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { test } from 'node:test';
import { loadContent, structureDiff, structureOf, validateLesson, type Obj } from '../scripts/lessons';

const CONTENT = resolve(__dirname, '..', '..', 'content');
const read = (p: string) => JSON.parse(readFileSync(join(CONTENT, p), 'utf8')) as Obj;

test('настоящие уроки из content/ проходят проверку, ru и kk совпадают', () => {
  const { lessons, errors } = loadContent(CONTENT);
  assert.deepEqual(errors, []);
  assert.ok(lessons.length >= 2);
  for (const l of lessons) assert.equal(l.translations.length, 1, `${l.base.path}: нет перевода kk`);
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
  (kk.steps as Obj[])[2].expected = 0;
  writeFileSync(join(dir, 'python', '01-skidka-v-kafe.kk.json'), JSON.stringify(kk));
  writeFileSync(join(dir, 'math', '01-dvor-maks-ploshchadi.kk.json'), readFileSync(join(CONTENT, 'math/01-dvor-maks-ploshchadi.kk.json')));
  writeFileSync(join(dir, 'math', '02-oshibka.json'), '{ не json');
  const { errors } = loadContent(dir);
  const e = errors.join('\n');
  assert.match(e, /01-skidka-v-kafe\.kk\.json: структура не совпадает .* steps\[2\]\.expected/);
  assert.match(e, /нет основного файла math\/01-dvor-maks-ploshchadi\.json/);
  assert.match(e, /02-oshibka\.json: не JSON/);
});
