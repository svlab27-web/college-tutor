// Vercel Function: все запросы /api/* → общий маршрутизатор.
// Вебхук бота — тоже здесь (POST /api/bot): одна функция и на Vercel, и на своём сервере.

import { route } from './_lib/router';

export const GET = route;
export const POST = route;
