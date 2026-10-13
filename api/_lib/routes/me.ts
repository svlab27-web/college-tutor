// GET /api/me  — кто я, мои группы, что ещё нужно; по start_param — вступление в группу
// POST /api/me — ФИО, год рождения, язык интерфейса

import { db } from '../db';
import { HttpError, json } from '../http';
import { isInviteToken, joinByInvite, type JoinResult } from '../invites';
import {
  CONSENT_DOC_VERSION,
  cleanBirthYear,
  cleanFullName,
  cleanLanguage,
  profileStatus,
} from '../profile';
import { readJson, requireIdentity } from '../session';
import { consentFlags, upsertUser, userGroups, type UserRow } from '../users';

async function profile(user: UserRow, languageCode: string | undefined, join: JoinResult | null) {
  const sql = db();
  const [groups, flags] = await Promise.all([
    userGroups(sql, user.id),
    consentFlags(sql, user.id, CONSENT_DOC_VERSION),
  ]);
  const status = profileStatus({
    fullName: user.full_name,
    birthYear: user.birth_year,
    ...flags,
    currentYear: new Date().getFullYear(),
  });
  // Язык: выбор студента → язык Telegram → язык первой группы → русский
  const language =
    user.ui_language ?? cleanLanguage(languageCode) ?? cleanLanguage(groups[0]?.language) ?? 'ru';

  return {
    user: {
      id: user.id,
      role: user.role,
      full_name: user.full_name,
      full_name_locked: user.full_name_source === 'roster',
      birth_year: user.birth_year,
      ui_language: user.ui_language,
    },
    language,
    groups,
    join,
    needs: status.needs,
    minor: status.minor,
    can_save_progress: status.canSaveProgress,
    consent_version: CONSENT_DOC_VERSION,
  };
}

export async function getMe(req: Request): Promise<Response> {
  const identity = requireIdentity(req);
  const user = await upsertUser(db(), identity.telegramUserId);
  const join = isInviteToken(identity.startParam)
    ? await joinByInvite(db(), user.id, identity.startParam)
    : null;
  // После вступления по персональному приглашению могли поменяться ФИО и роль
  const fresh = join?.status === 'joined' ? await upsertUser(db(), identity.telegramUserId) : user;
  return json(200, await profile(fresh, identity.languageCode, join));
}

export async function postMe(req: Request): Promise<Response> {
  const identity = requireIdentity(req);
  const body = await readJson(req);
  const sql = db();
  const user = await upsertUser(sql, identity.telegramUserId);

  let fullName: string | undefined;
  if ('full_name' in body) {
    if (user.full_name_source === 'roster') {
      throw new HttpError(409, 'full_name_locked', 'ФИО внесено колледжем. Чтобы исправить, напишите преподавателю.');
    }
    fullName = cleanFullName(body.full_name) ?? undefined;
    if (!fullName) throw new HttpError(400, 'bad_full_name', 'Введите фамилию и имя буквами.');
  }

  let birthYear: number | undefined;
  if ('birth_year' in body) {
    birthYear = cleanBirthYear(body.birth_year) ?? undefined;
    if (!birthYear) throw new HttpError(400, 'bad_birth_year', 'Проверьте год рождения.');
    // Меняет только преподаватель — иначе правило для младше 18 легко обойти
    if (user.birth_year !== null && user.birth_year !== birthYear) {
      throw new HttpError(409, 'birth_year_locked', 'Год рождения уже указан. Чтобы исправить, напишите преподавателю.');
    }
  }

  let uiLanguage: 'ru' | 'kk' | undefined;
  if ('ui_language' in body) {
    uiLanguage = cleanLanguage(body.ui_language) ?? undefined;
    if (!uiLanguage) throw new HttpError(400, 'bad_language', 'Язык: ru или kk.');
  }

  const [updated] = await sql<UserRow[]>`
    update users set
      full_name        = coalesce(${fullName ?? null}, full_name),
      full_name_source = case when ${fullName ?? null}::text is null then full_name_source else 'self' end,
      birth_year       = coalesce(${birthYear ?? null}::smallint, birth_year),
      ui_language      = coalesce(${uiLanguage ?? null}, ui_language)
    where id = ${user.id}
    returning id, role, full_name, full_name_source, birth_year, ui_language`;

  return json(200, await profile(updated, identity.languageCode, null));
}
