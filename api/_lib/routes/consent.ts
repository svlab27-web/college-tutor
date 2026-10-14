// POST /api/consent — студент сам даёт согласие на обработку ПД (kind = personal_data).
// Согласие родителя отмечает куратор (granted_via = paper / college_list, 005) — это API кабинета (#9).
// Без личной ссылки (студент не заведён куратором) — 403, в демо согласие не пишем.

import { db } from '../db';
import { HttpError, json } from '../http';
import { CONSENT_DOC_VERSION } from '../profile';
import { readJson, requireIdentity } from '../session';
import { requireUser } from '../users';

export async function postConsent(req: Request): Promise<Response> {
  const identity = requireIdentity(req);
  const body = await readJson(req);

  // Студент соглашается с тем текстом, который видел. Текст поменялся — показать заново.
  if (body.doc_version !== CONSENT_DOC_VERSION) {
    throw new HttpError(409, 'consent_outdated', 'Текст согласия обновился. Прочитайте его ещё раз.');
  }

  const sql = db();
  const user = await requireUser(sql, identity.telegramUserId);
  // Повторное «Согласен» не создаёт дубль — уникальный индекс consents_one_active (005)
  await sql`
    insert into consents (user_id, telegram_user_id, kind, doc_version, granted_via)
    values (${user.id}, ${identity.telegramUserId}, 'personal_data', ${CONSENT_DOC_VERSION}, 'telegram')
    on conflict (user_id, kind, doc_version) where revoked_at is null and kind = 'personal_data'
    do nothing`;

  return json(200, { ok: true, consent_version: CONSENT_DOC_VERSION });
}
