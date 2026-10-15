// Vercel Function: все запросы /api/* → общий маршрутизатор.
// Вне Next.js [...path] ловит только один сегмент — поэтому в vercel.json rewrite /api/:path* сюда.
// Вебхук бота — тоже здесь (POST /api/bot): одна функция и на Vercel, и на своём сервере.

import { route } from './_lib/router';

export const GET = route;
export const POST = route;
export const PATCH = route;
export const DELETE = route;
