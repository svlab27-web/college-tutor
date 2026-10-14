// POST /api/help — обращение к куратору: «нужна помощь» в уроке или «ошибка в ФИО».
// Тело: { kind: 'help' | 'name_error', text, lesson_id? }. Пишем в help_requests группы студента.
// Уведомление куратору в Telegram — позже (кабинет, #9).

import { db } from '../db';
import { HttpError, json } from '../http';
import { CONSENT_DOC_VERSION, profileStatus, todayInKazakhstan } from '../profile';
import { readJson, requireIdentity } from '../session';
import { consentFlags, requireUser } from '../users';

const MAX_TEXT = 1000;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function postHelp(req: Request): Promise<Response> {
  const identity = requireIdentity(req);
  const body = await readJson(req);

  const kind = body.kind === 'name_error' ? 'name_error' : 'help';
  const text = typeof body.text === 'string' ? body.text.trim() : '';
  if (!text || text.length > MAX_TEXT) {
    throw new HttpError(400, 'bad_text', `Напишите, в чём дело (до ${MAX_TEXT} символов).`);
  }
  const lessonId = typeof body.lesson_id === 'string' && UUID.test(body.lesson_id) ? body.lesson_id : null;

  const sql = db();
  const user = await requireUser(sql, identity.telegramUserId);

  // Свободный текст — это тоже данные студента: пока нет согласия (а у младше 18 —
  // согласия родителя), принимаем только «ошибку в ФИО» — её нужно исправить до согласия
  if (kind === 'help') {
    const flags = await consentFlags(sql, user.id, CONSENT_DOC_VERSION);
    const status = profileStatus({
      fullName: user.full_name,
      birth: { date: user.birth_date, year: user.birth_year },
      ...flags,
      today: todayInKazakhstan(),
    });
    if (!status.canSaveProgress) {
      throw new HttpError(403, 'consent_required', 'Сначала нужно согласие на обработку данных. Ошибку в ФИО можно сообщить уже сейчас.');
    }
  }

  const [request] = await sql<{ id: string }[]>`
    insert into help_requests (user_id, group_id, lesson_id, text)
    values (
      ${user.id},
      (select group_id from group_members where user_id = ${user.id} and role = 'student'
        order by joined_at limit 1),
      (select id from lessons where id = ${lessonId}::uuid), -- несуществующий урок — просто без урока
      ${kind === 'name_error' ? `Ошибка в ФИО: ${text}` : text}
    )
    returning id`;
  return json(200, { ok: true, id: request.id });
}
