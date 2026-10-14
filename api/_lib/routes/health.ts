// GET /api/health — жив ли сервер и доступна ли база (для мониторинга, docs/production.md п. 9).
// Ошибки базы — только в логах; наружу — код состояния.

import { db, dbConfigured } from '../db';
import { env } from '../env';
import { json } from '../http';

export async function health(): Promise<Response> {
  const version = env('VERCEL_GIT_COMMIT_SHA')?.slice(0, 7) ?? env('APP_VERSION') ?? 'dev';

  if (!dbConfigured()) {
    return json(503, { ok: false, db: 'not_configured', version });
  }

  try {
    await db()`select 1`;
    return json(200, { ok: true, db: 'ok', version });
  } catch (error) {
    console.error('health: база недоступна:', (error as Error).message);
    return json(503, { ok: false, db: 'error', version });
  }
}
