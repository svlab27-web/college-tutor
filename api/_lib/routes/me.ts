// GET /api/me  — кто я, мои группы, что ещё нужно; по start_param — вход по личной ссылке
// POST /api/me — язык интерфейса. ФИО и год рождения вносит куратор (решение 14.10.2026).

import type { TelegramIdentity } from '../auth';
import { db } from '../db';
import { HttpError, json } from '../http';
import { bindInvite, isInviteToken, type JoinResult } from '../invites';
import { CONSENT_DOC_VERSION, cleanLanguage, profileStatus, todayInKazakhstan } from '../profile';
import { readJson, requireIdentity } from '../session';
import { consentFlags, findUser, requireUser, userGroups, type UserRow } from '../users';

async function profile(user: UserRow, identity: TelegramIdentity, join: JoinResult | null) {
  const sql = db();
  const [groups, flags] = await Promise.all([
    userGroups(sql, user.id),
    consentFlags(sql, user.id, CONSENT_DOC_VERSION),
  ]);
  const status = profileStatus({
    fullName: user.full_name,
    birth: { date: user.birth_date, year: user.birth_year },
    ...flags,
    today: todayInKazakhstan(),
  });
  // Язык: выбор студента → язык Telegram → язык первой группы → русский
  const language =
    user.ui_language ?? cleanLanguage(identity.languageCode) ?? cleanLanguage(groups[0]?.language) ?? 'ru';

  return {
    registered: true,
    user: {
      id: user.id,
      role: user.role,
      full_name: user.full_name,
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
  const join = isInviteToken(identity.startParam)
    ? await bindInvite(db(), identity.telegramUserId, identity.startParam)
    : null;
  const user = await findUser(db(), identity.telegramUserId);
  if (!user) {
    // Без личной ссылки — демо: в базу ничего не пишем
    return json(200, {
      registered: false,
      join,
      language: cleanLanguage(identity.languageCode) ?? 'ru',
      can_save_progress: false,
    });
  }
  return json(200, await profile(user, identity, join));
}

export async function postMe(req: Request): Promise<Response> {
  const identity = requireIdentity(req);
  const body = await readJson(req);
  if ('full_name' in body || 'birth_year' in body || 'birth_date' in body) {
    throw new HttpError(
      409,
      'roster_only',
      'ФИО и год рождения вносит куратор. Если есть ошибка — нажмите «Сообщить об ошибке».',
    );
  }
  const uiLanguage = cleanLanguage(body.ui_language);
  if (!uiLanguage) throw new HttpError(400, 'bad_language', 'Язык: ru или kk.');

  const sql = db();
  const user = await requireUser(sql, identity.telegramUserId);
  const [updated] = await sql<UserRow[]>`
    update users set ui_language = ${uiLanguage} where id = ${user.id}
    returning id, role, full_name, full_name_source, birth_year, birth_date::text, ui_language`;
  return json(200, await profile(updated, identity, null));
}
