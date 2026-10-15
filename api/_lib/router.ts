// Один маршрутизатор на все /api/* (лимит Hobby — 12 функций, docs/api.md п. 0).
// Обработчики не знают про платформу: Request → Response.
// Подключают его api/index.ts (Vercel, через rewrite в vercel.json) и server/index.ts (свой сервер).

import { ConfigError } from './env';
import { HttpError, json } from './http';
import { postBot } from './routes/bot';
import { postConsent } from './routes/consent';
import {
  deleteCuratorParental,
  getCuratorGroups,
  getCuratorStudents,
  patchCuratorStudent,
  postCuratorInvite,
  postCuratorParental,
  postCuratorStudent,
  postCuratorStudentsBulk,
  postCuratorUnlink,
} from './routes/curator';
import { health } from './routes/health';
import { postHelp } from './routes/help';
import { getMe, postMe } from './routes/me';

type Handler = (req: Request) => Promise<Response>;

const routes: Record<string, Partial<Record<string, Handler>>> = {
  '/api/health': { GET: health },
  '/api/me': { GET: getMe, POST: postMe },
  '/api/consent': { POST: postConsent },
  '/api/help': { POST: postHelp },
  '/api/bot': { POST: postBot },
  '/api/curator/groups': { GET: getCuratorGroups },
  '/api/curator/students': { GET: getCuratorStudents, POST: postCuratorStudent },
  '/api/curator/students/bulk': { POST: postCuratorStudentsBulk },
};

// Пути с id студента: обработчик сам достаёт id из URL и проверяет доступ
const patterns: { re: RegExp; methods: Partial<Record<string, Handler>> }[] = [
  { re: /^\/api\/curator\/students\/[^/]+$/, methods: { PATCH: patchCuratorStudent } },
  { re: /^\/api\/curator\/students\/[^/]+\/invite$/, methods: { POST: postCuratorInvite } },
  { re: /^\/api\/curator\/students\/[^/]+\/parental$/, methods: { POST: postCuratorParental, DELETE: deleteCuratorParental } },
  { re: /^\/api\/curator\/students\/[^/]+\/unlink$/, methods: { POST: postCuratorUnlink } },
];

export async function route(req: Request): Promise<Response> {
  const path = new URL(req.url).pathname.replace(/\/+$/, '') || '/';
  const methods = routes[path] ?? patterns.find((p) => p.re.test(path))?.methods;
  if (!methods) return json(404, { error: 'not_found' });

  const handler = methods[req.method];
  if (!handler) {
    return json(405, { error: 'method_not_allowed' }, { allow: Object.keys(methods).join(', ') });
  }

  try {
    return await handler(req);
  } catch (error) {
    if (error instanceof HttpError) {
      return json(error.status, { error: error.code, message: error.message });
    }
    if (error instanceof ConfigError) {
      console.error(`${req.method} ${path}:`, error.message);
      return json(503, { error: 'not_configured', message: 'Сервис ещё настраивается. Попробуйте позже.' });
    }
    // В логи — только код, ограничение и текст: в detail ошибки базы бывают значения строк
    // (Telegram ID, ФИО), им в логах не место
    const e = error as { code?: string; constraint_name?: string; message?: string };
    console.error(`${req.method} ${path}:`, { code: e.code, constraint: e.constraint_name, message: e.message });
    return json(500, { error: 'internal', message: 'Что-то пошло не так. Попробуйте ещё раз.' });
  }
}
