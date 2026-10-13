import assert from 'node:assert/strict';
import { test } from 'node:test';
import { cleanBirthYear, cleanFullName, cleanLanguage, isMinor, profileStatus } from '../api/_lib/profile';

const base = { fullName: 'Иванова Айгерим', birthYear: 2000, hasConsent: true, hasParentalConsent: false, currentYear: 2026 };

test('взрослый со всем заполненным — можно сохранять прогресс', () => {
  assert.deepEqual(profileStatus(base), { needs: [], minor: false, canSaveProgress: true });
});

test('новый студент — нужно всё, возраст неизвестен', () => {
  const s = profileStatus({ ...base, fullName: null, birthYear: null, hasConsent: false });
  assert.deepEqual(s, { needs: ['full_name', 'birth_year', 'consent'], minor: null, canSaveProgress: false });
});

test('младше 18 без согласия родителя — только демо', () => {
  const s = profileStatus({ ...base, birthYear: 2010 });
  assert.deepEqual(s, { needs: ['parental_consent'], minor: true, canSaveProgress: false });
});

test('младше 18 с согласием родителя — можно', () => {
  assert.equal(profileStatus({ ...base, birthYear: 2010, hasParentalConsent: true }).canSaveProgress, true);
});

test('спорный год (18 исполняется в этом году) считаем несовершеннолетним', () => {
  assert.equal(isMinor(2008, 2026), true);
  assert.equal(isMinor(2007, 2026), false);
});

test('ФИО: буквы, пробелы, дефис; лишние пробелы убираем', () => {
  assert.equal(cleanFullName('  Петрова   Анна-Мария '), 'Петрова Анна-Мария');
  assert.equal(cleanFullName('Сейткали Әлия'), 'Сейткали Әлия');
  assert.equal(cleanFullName('Ivanov Ivan'), 'Ivanov Ivan');
  assert.equal(cleanFullName('А'), null);
  assert.equal(cleanFullName('Иван123'), null);
  assert.equal(cleanFullName('<script>'), null);
  assert.equal(cleanFullName(42), null);
});

test('год рождения: 1950–2020, число или строка', () => {
  assert.equal(cleanBirthYear(2008), 2008);
  assert.equal(cleanBirthYear('2008'), 2008);
  assert.equal(cleanBirthYear(1949), null);
  assert.equal(cleanBirthYear(2021), null);
  assert.equal(cleanBirthYear(2008.5), null);
  assert.equal(cleanBirthYear(null), null);
});

test('язык: только ru / kk', () => {
  assert.equal(cleanLanguage('kk'), 'kk');
  assert.equal(cleanLanguage('en'), null);
});
