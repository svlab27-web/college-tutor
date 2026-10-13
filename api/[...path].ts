// Vercel Function: все запросы /api/* → общий маршрутизатор.
// Вебхук бота будет отдельной функцией api/bot.ts (PR 2).

import { route } from './_lib/router';

export const GET = route;
export const POST = route;
