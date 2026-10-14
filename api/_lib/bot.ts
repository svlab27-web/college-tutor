// Бот: /start, /start <код>, /help. Без базы и без исходящих запросов —
// ответ уходит прямо в ответе на вебхук (Telegram это разрешает), поэтому токен бота тут не нужен.
// https://core.telegram.org/bots/api#making-requests-when-getting-updates

import { isInviteToken } from './invites';

export interface BotConfig {
  botUsername: string; // без @
  appUrl: string | undefined;
}

interface Update {
  message?: {
    chat?: { id?: number; type?: string };
    text?: string;
  };
}

export type BotReply = {
  method: 'sendMessage';
  chat_id: number;
  text: string;
  reply_markup?: { inline_keyboard: { text: string; url?: string; web_app?: { url: string } }[][] };
};

const HELP =
  'Это AI-тьютор «Мой колледж».\n\n' +
  '• Чтобы войти, откройте свою личную ссылку от куратора группы.\n' +
  '• Уроки, подсказки и прогресс — в приложении: кнопка «Мой колледж» внизу или кнопка под этим сообщением.\n' +
  '• Застряли в задании — нажмите «Нужна помощь» в уроке, куратор увидит.';

export function handleUpdate(update: unknown, cfg: BotConfig): BotReply | null {
  const message = (update as Update)?.message;
  const chatId = message?.chat?.id;
  // Только личные сообщения: в группах бот молчит
  if (typeof chatId !== 'number' || message?.chat?.type !== 'private' || typeof message.text !== 'string') {
    return null;
  }

  const [command, payload] = message.text.trim().split(/\s+/, 2);
  const name = command.split('@')[0].toLowerCase();

  if (name === '/start' && isInviteToken(payload)) {
    // Код передаём через startapp — тогда он придёт в initData подписанным
    return reply(chatId, 'Откройте приложение — вы попадёте в свою группу.', {
      text: 'Открыть «Мой колледж»',
      url: `https://t.me/${cfg.botUsername}?startapp=${payload}`,
    });
  }
  if (name === '/start') {
    return reply(chatId, 'Здравствуйте! Уроки и прогресс — в приложении.', openApp(cfg));
  }
  if (name === '/help') {
    return reply(chatId, HELP, openApp(cfg));
  }
  return reply(chatId, 'Я отвечаю на /start и /help. Всё остальное — в приложении.', openApp(cfg));
}

function openApp(cfg: BotConfig) {
  return cfg.appUrl
    ? { text: 'Открыть «Мой колледж»', web_app: { url: cfg.appUrl } }
    : { text: 'Открыть «Мой колледж»', url: `https://t.me/${cfg.botUsername}?startapp` };
}

function reply(chatId: number, text: string, button: { text: string; url?: string; web_app?: { url: string } }): BotReply {
  return { method: 'sendMessage', chat_id: chatId, text, reply_markup: { inline_keyboard: [[button]] } };
}
