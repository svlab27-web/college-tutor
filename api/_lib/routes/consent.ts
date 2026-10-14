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
  await sql`
    insert into consents (user_id, telegram_user_id, kind, doc_version, granted_via)
    select ${user.id}::uuid, ${identity.telegramUserId}::bigint, 'personal_data', ${CONSENT_DOC_VERSION}::text, 'telegram'
     where not exists (
       select 1 from consents
        where user_id = ${user.id} and kind = 'personal_data'
          and doc_version = ${CONSENT_DOC_VERSION} and revoked_at is null)`;

  return json(200, { ok: true, consent_version: CONSENT_DOC_VERSION });
}
