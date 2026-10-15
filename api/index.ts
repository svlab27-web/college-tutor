// Vercel Function: все запросы /api/* → общий маршрутизатор (одна функция — лимит Hobby, docs/api.md п. 0).
// Вне Next.js файл api/[...path].ts ловит только один сегмент пути (/api/me — да, /api/curator/groups — нет),
// поэтому vercel.json переписывает /api/<путь> → /api?__path=<путь>, а здесь исходный путь восстанавливаем.
// Вебхук бота — тоже здесь (POST /api/bot): одна функция и на Vercel, и на своём сервере.

import { route } from './_lib/router';

export const ORIGINAL_PATH = '__path';

export function restorePath(req: Request): Request {
  const url = new URL(req.url);
  const original = url.searchParams.get(ORIGINAL_PATH);
  if (original === null) return req;
  url.searchParams.delete(ORIGINAL_PATH);
  url.pathname = `/api/${original.replace(/^\/+/, '')}`;
  return new Request(url, req);
}

const handler = (req: Request) => route(restorePath(req));

export const GET = handler;
export const POST = handler;
export const PATCH = handler;
export const DELETE = handler;
