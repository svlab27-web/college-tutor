import assert from 'node:assert/strict';
import { test } from 'node:test';
import { cleanLanguage, isMinor, profileStatus } from '../api/_lib/profile';

const base = { fullName: 'Иванова Айгерим', birthYear: 2000, hasConsent: true, hasParentalConsent: false, currentYear: 2026 };

test('взрослый: куратор заполнил, согласие есть — можно сохранять прогресс', () => {
  assert.deepEqual(profileStatus(base), { needs: [], minor: false, canSaveProgress: true });
});

test('куратор не заполнил ФИО или год — roster, возраст неизвестен', () => {
  assert.deepEqual(profileStatus({ ...base, birthYear: null }), { needs: ['roster'], minor: null, canSaveProgress: false });
  assert.deepEqual(profileStatus({ ...base, fullName: null }).needs, ['roster']);
});

test('нет согласия студента — consent', () => {
  assert.deepEqual(profileStatus({ ...base, hasConsent: false }).needs, ['consent']);
});

test('младше 18 без отметки куратора о согласии родителя — только демо', () => {
  const s = profileStatus({ ...base, birthYear: 2010 });
  assert.deepEqual(s, { needs: ['parental_consent'], minor: true, canSaveProgress: false });
});

test('младше 18 с отметкой куратора — можно', () => {
  assert.equal(profileStatus({ ...base, birthYear: 2010, hasParentalConsent: true }).canSaveProgress, true);
});

test('спорный год (18 исполняется в этом году) считаем несовершеннолетним; в следующем году — взрослый', () => {
  assert.equal(isMinor(2008, 2026), true);
  assert.equal(isMinor(2008, 2027), false);
});

test('язык: только ru / kk', () => {
  assert.equal(cleanLanguage('kk'), 'kk');
  assert.equal(cleanLanguage('en'), null);
});
