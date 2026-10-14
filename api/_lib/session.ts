// Кто делает запрос: только по проверенному initData из заголовка X-Telegram-Init-Data.

import { INIT_DATA_HEADER, verifyInitData, type TelegramIdentity } from './auth';
import { requireEnv } from './env';
import { HttpError } from './http';

export function requireIdentity(req: Request): TelegramIdentity {
  const result = verifyInitData(req.headers.get(INIT_DATA_HEADER), requireEnv('BOT_TOKEN'));
  if (!result.ok) {
    throw new HttpError(401, 'unauthorized', 'Откройте приложение заново из Telegram.');
  }
  return result.identity;
}

export async function readJson(req: Request): Promise<Record<string, unknown>> {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    throw new HttpError(400, 'bad_json', 'Не удалось прочитать запрос.');
  }
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw new HttpError(400, 'bad_json', 'Не удалось прочитать запрос.');
  }
  return body as Record<string, unknown>;
}
