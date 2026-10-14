// Проверка initData Telegram Mini App (docs/api.md, п. 1).
// https://core.telegram.org/bots/webapps#validating-data-received-via-the-mini-app
//
// Личность студента — только из проверенной строки: user.id.
// initDataUnsafe и username для личности не используем.

import { createHmac, timingSafeEqual } from 'node:crypto';

export const INIT_DATA_HEADER = 'x-telegram-init-data';
export const INIT_DATA_MAX_AGE_SEC = 24 * 60 * 60;

export interface TelegramIdentity {
  telegramUserId: number;
  languageCode?: string;
  startParam?: string;
  authDate: number;
}

export type InitDataResult =
  | { ok: true; identity: TelegramIdentity }
  | { ok: false; reason: 'missing' | 'bad_hash' | 'expired' | 'bad_user' };

export function signInitData(fields: Record<string, string>, botToken: string): string {
  const secret = createHmac('sha256', 'WebAppData').update(botToken).digest();
  return createHmac('sha256', secret).update(dataCheckString(fields)).digest('hex');
}

export function verifyInitData(
  initData: string | null | undefined,
  botToken: string,
  now: number = Date.now(),
  maxAgeSec: number = INIT_DATA_MAX_AGE_SEC,
): InitDataResult {
  if (!initData) return { ok: false, reason: 'missing' };

  const params = new URLSearchParams(initData);
  const hash = params.get('hash');
  if (!hash || !/^[0-9a-f]{64}$/i.test(hash)) return { ok: false, reason: 'bad_hash' };

  const fields: Record<string, string> = {};
  for (const [key, value] of params) {
    if (key !== 'hash') fields[key] = value;
  }

  const expected = Buffer.from(signInitData(fields, botToken), 'hex');
  const received = Buffer.from(hash, 'hex');
  if (!timingSafeEqual(expected, received)) return { ok: false, reason: 'bad_hash' };

  const authDate = Number(fields.auth_date);
  const ageSec = now / 1000 - authDate;
  // небольшой запас на расхождение часов
  if (!Number.isInteger(authDate) || ageSec > maxAgeSec || ageSec < -60) {
    return { ok: false, reason: 'expired' };
  }

  let telegramUserId: unknown;
  let languageCode: unknown;
  try {
    const user = JSON.parse(fields.user ?? '');
    telegramUserId = user?.id;
    languageCode = user?.language_code;
  } catch {
    return { ok: false, reason: 'bad_user' };
  }
  if (!Number.isSafeInteger(telegramUserId) || (telegramUserId as number) <= 0) {
    return { ok: false, reason: 'bad_user' };
  }

  return {
    ok: true,
    identity: {
      telegramUserId: telegramUserId as number,
      languageCode: typeof languageCode === 'string' ? languageCode : undefined,
      startParam: fields.start_param || undefined,
      authDate,
    },
  };
}

// Все поля, кроме hash, по алфавиту, key=value через \n
function dataCheckString(fields: Record<string, string>): string {
  return Object.keys(fields)
    .sort()
    .map((key) => `${key}=${fields[key]}`)
    .join('\n');
}
