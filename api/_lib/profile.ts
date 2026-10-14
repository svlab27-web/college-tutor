// Что студенту ещё нужно до уроков с сохранением прогресса — без базы, чтобы проверять тестами.
//
// Решение 14.10.2026: ФИО и год рождения вносит куратор, отметку о согласии родителя — тоже.
// Студент сам даёт только согласие на обработку ПД.
//   roster           — куратор не заполнил ФИО или год рождения (студент ничего сделать не может);
//   consent          — студент ещё не дал согласие;
//   parental_consent — младше 18, куратор ещё не отметил согласие родителя.
// Младше 18 без согласия родителя — только демо без сохранения прогресса.
// В базе только год рождения, поэтому год, в котором исполняется 18, считаем
// несовершеннолетним — безопаснее.

export const CONSENT_DOC_VERSION = 'draft-2026-10'; // docs/consent-draft.md, app/consent.js

export type Need = 'roster' | 'consent' | 'parental_consent';

export interface ProfileFacts {
  fullName: string | null;
  birthYear: number | null;
  hasConsent: boolean;
  hasParentalConsent: boolean;
  currentYear: number;
}

export interface ProfileStatus {
  needs: Need[];
  minor: boolean | null;
  canSaveProgress: boolean;
}

export function isMinor(birthYear: number, currentYear: number): boolean {
  return currentYear - birthYear <= 18;
}

export function profileStatus(f: ProfileFacts): ProfileStatus {
  const minor = f.birthYear === null ? null : isMinor(f.birthYear, f.currentYear);
  const needs: Need[] = [];
  if (!f.fullName || f.birthYear === null) needs.push('roster');
  if (!f.hasConsent) needs.push('consent');
  if (minor && !f.hasParentalConsent) needs.push('parental_consent');
  return { needs, minor, canSaveProgress: needs.length === 0 };
}

export function cleanLanguage(value: unknown): 'ru' | 'kk' | null {
  return value === 'ru' || value === 'kk' ? value : null;
}
