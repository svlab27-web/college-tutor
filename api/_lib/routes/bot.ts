// POST /api/bot — вебхук Telegram. Проверяем X-Telegram-Bot-Api-Secret-Token (TG_WEBHOOK_SECRET).
// Telegram повторяет запрос при любом ответе, кроме 200, поэтому на непонятные обновления — 200 без действия.

import { timingSafeEqual } from 'node:crypto';
import { handleUpdate } from '../bot';
import { env, requireEnv } from '../env';
import { json } from '../http';

const SECRET_HEADER = 'x-telegram-bot-api-secret-token';

function sameSecret(received: string | null, expected: string): boolean {
  if (!received) return false;
  const a = Buffer.from(received);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function postBot(req: Request): Promise<Response> {
  if (!sameSecret(req.headers.get(SECRET_HEADER), requireEnv('TG_WEBHOOK_SECRET'))) {
    return json(401, { error: 'unauthorized' });
  }

  let update: unknown;
  try {
    update = await req.json();
  } catch {
    return json(200, {});
  }

  const reply = handleUpdate(update, {
    botUsername: env('BOT_USERNAME') ?? 'tutornvl_bot',
    appUrl: env('APP_URL'),
  });
  return json(200, reply ?? {});
}
