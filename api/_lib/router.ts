// Один маршрутизатор на все /api/* (лимит Hobby — 12 функций, docs/api.md п. 0).
// Обработчики не знают про платформу: Request → Response.
// Подключают его api/[...path].ts (Vercel) и server/index.ts (свой сервер).

import { HttpError, json } from './http';
import { health } from './routes/health';

type Handler = (req: Request) => Promise<Response>;

const routes: Record<string, Partial<Record<string, Handler>>> = {
  '/api/health': { GET: health },
};

export async function route(req: Request): Promise<Response> {
  const path = new URL(req.url).pathname.replace(/\/+$/, '') || '/';
  const methods = routes[path];
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
    console.error(`${req.method} ${path}:`, error);
    return json(500, { error: 'internal', message: 'Что-то пошло не так. Попробуйте ещё раз.' });
  }
}
