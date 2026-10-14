import assert from 'node:assert/strict';
import { test } from 'node:test';
import { cleanLanguage, isMinor, profileStatus, todayInKazakhstan } from '../api/_lib/profile';

const today = '2026-10-14';
const adult = { date: null, year: 2000 };
const base = { fullName: 'Иванова Айгерим', birth: adult, hasConsent: true, hasParentalConsent: false, today };

test('взрослый: куратор заполнил, согласие есть — можно сохранять прогресс', () => {
  assert.deepEqual(profileStatus(base), { needs: [], minor: false, canSaveProgress: true });
});

test('куратор не заполнил ФИО или год — roster, возраст неизвестен', () => {
  assert.deepEqual(profileStatus({ ...base, birth: { date: null, year: null } }), {
    needs: ['roster'],
    minor: null,
    canSaveProgress: false,
  });
  assert.deepEqual(profileStatus({ ...base, fullName: null }).needs, ['roster']);
});

test('нет согласия студента — consent', () => {
  assert.deepEqual(profileStatus({ ...base, hasConsent: false }).needs, ['consent']);
});

test('младше 18 без отметки куратора о согласии родителя — только демо', () => {
  const s = profileStatus({ ...base, birth: { date: null, year: 2010 } });
  assert.deepEqual(s, { needs: ['parental_consent'], minor: true, canSaveProgress: false });
});

test('младше 18 с отметкой куратора — можно', () => {
  assert.equal(profileStatus({ ...base, birth: { date: null, year: 2010 }, hasParentalConsent: true }).canSaveProgress, true);
});

test('только год: год, в котором исполняется 18, — несовершеннолетний; в следующем — взрослый', () => {
  assert.equal(isMinor({ date: null, year: 2008 }, '2026-12-31'), true);
  assert.equal(isMinor({ date: null, year: 2008 }, '2027-01-01'), false);
});

test('дата рождения: 18 наступает ровно в день рождения', () => {
  const birth = { date: '2008-10-15', year: 2008 };
  assert.equal(isMinor(birth, '2026-10-14'), true);
  assert.equal(isMinor(birth, '2026-10-15'), false);
  assert.equal(isMinor({ date: '2008-01-01', year: 2008 }, '2026-01-01'), false);
  assert.equal(isMinor({ date: '2008-12-31', year: 2008 }, '2026-12-30'), true);
});

test('дата рождения 29 февраля: совершеннолетие с 1 марта в невисокосный год', () => {
  const birth = { date: '2008-02-29', year: 2008 };
  assert.equal(isMinor(birth, '2026-02-28'), true);
  assert.equal(isMinor(birth, '2026-03-01'), false);
});

test('дата важнее года: родился в начале года — взрослый уже в этом году', () => {
  const s = profileStatus({ ...base, birth: { date: '2008-03-01', year: 2008 } });
  assert.equal(s.minor, false);
  assert.deepEqual(s.needs, []);
});

test('сегодня — по времени Казахстана (UTC+5)', () => {
  // 13.10 21:00 UTC = 14.10 02:00 в Алматы
  assert.equal(todayInKazakhstan(new Date(Date.UTC(2026, 9, 13, 21, 0))), '2026-10-14');
  assert.equal(todayInKazakhstan(new Date(Date.UTC(2026, 9, 13, 18, 0))), '2026-10-13');
});

test('язык: только ru / kk', () => {
  assert.equal(cleanLanguage('kk'), 'kk');
  assert.equal(cleanLanguage('en'), null);
});
