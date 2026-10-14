// Что студенту ещё нужно до уроков с сохранением прогресса — без базы, чтобы проверять тестами.
//
// Решение 14.10.2026: ФИО и дату (или год) рождения вносит куратор, отметку о согласии
// родителя — тоже. Студент сам даёт только согласие на обработку ПД.
//   roster           — куратор не заполнил ФИО или год рождения (студент ничего сделать не может);
//   consent          — студент ещё не дал согласие;
//   parental_consent — младше 18, куратор ещё не отметил согласие родителя.
// Младше 18 без согласия родителя — только демо без сохранения прогресса.
// Есть дата рождения — 18 лет наступает в день рождения (по времени Казахстана).
// Только год — год, в котором исполняется 18, считаем несовершеннолетним: безопаснее.

export const CONSENT_DOC_VERSION = 'draft-2026-10'; // docs/consent-draft.md, app/consent.js

export type Need = 'roster' | 'consent' | 'parental_consent';

export interface Birth {
  date: string | null; // 'YYYY-MM-DD'
  year: number | null;
}

export interface ProfileFacts {
  fullName: string | null;
  birth: Birth;
  hasConsent: boolean;
  hasParentalConsent: boolean;
  today: string; // 'YYYY-MM-DD'
}

export interface ProfileStatus {
  needs: Need[];
  minor: boolean | null;
  canSaveProgress: boolean;
}

// Сегодняшняя дата в Казахстане — день рождения считаем по местному календарю
export function todayInKazakhstan(now: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Almaty' }).format(now);
}

export function isMinor(birth: Birth, today: string): boolean | null {
  const year = Number(today.slice(0, 4));
  if (birth.date) {
    // 29 февраля: в невисокосный год «02-29» > «02-28», совершеннолетие — 1 марта
    const hadBirthday = today.slice(5) >= birth.date.slice(5);
    const age = year - Number(birth.date.slice(0, 4)) - (hadBirthday ? 0 : 1);
    return age < 18;
  }
  if (birth.year !== null) return year - birth.year <= 18;
  return null;
}

export function profileStatus(f: ProfileFacts): ProfileStatus {
  const minor = isMinor(f.birth, f.today);
  const needs: Need[] = [];
  if (!f.fullName || f.birth.year === null) needs.push('roster');
  if (!f.hasConsent) needs.push('consent');
  if (minor && !f.hasParentalConsent) needs.push('parental_consent');
  return { needs, minor, canSaveProgress: needs.length === 0 };
}

export function cleanLanguage(value: unknown): 'ru' | 'kk' | null {
  return value === 'ru' || value === 'kk' ? value : null;
}
