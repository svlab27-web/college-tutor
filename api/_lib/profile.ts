// Что студенту ещё нужно сделать до уроков с сохранением прогресса — без базы, чтобы проверять тестами.
//
// Правило (решение 13.10.2026): младше 18 без согласия родителя к урокам с сохранением
// НЕ пускаем — только демо без сохранения, пока преподаватель не внесёт согласие родителя.
// В базе только год рождения, поэтому спорный год (исполняется 18 в этом году) считаем
// несовершеннолетним — безопаснее.

export const CONSENT_DOC_VERSION = 'draft-2026-10'; // docs/consent-draft.md, app/consent.js

export type Need = 'full_name' | 'birth_year' | 'consent' | 'parental_consent';

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
  if (!f.fullName) needs.push('full_name');
  if (f.birthYear === null) needs.push('birth_year');
  if (!f.hasConsent) needs.push('consent');
  if (minor && !f.hasParentalConsent) needs.push('parental_consent');
  return { needs, minor, canSaveProgress: needs.length === 0 };
}

// ── Проверка полей POST /api/me ─────────────────────────────────
export const BIRTH_YEAR_MIN = 1950; // как check в 002
export const BIRTH_YEAR_MAX = 2020;

const FULL_NAME = /^\p{L}[\p{L}\s.'’-]{1,119}$/u;

export function cleanFullName(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const name = value.trim().replace(/\s+/g, ' ');
  return FULL_NAME.test(name) ? name : null;
}

export function cleanBirthYear(value: unknown): number | null {
  const year = typeof value === 'string' ? Number(value) : value;
  return Number.isInteger(year) && (year as number) >= BIRTH_YEAR_MIN && (year as number) <= BIRTH_YEAR_MAX
    ? (year as number)
    : null;
}

export function cleanLanguage(value: unknown): 'ru' | 'kk' | null {
  return value === 'ru' || value === 'kk' ? value : null;
}
