import assert from 'node:assert/strict';
import { test } from 'node:test';
import { handleUpdate } from '../api/_lib/bot';
import { route } from '../api/_lib/router';

const cfg = { botUsername: 'tutornvl_bot', appUrl: 'https://college-tutor.vercel.app' };
const msg = (text: string, type = 'private') => ({ message: { chat: { id: 42, type }, text } });

test('/start с личным кодом → кнопка t.me/…?startapp=<код>', () => {
  const r = handleUpdate(msg('/start i_AbCdEfGh12345678'), cfg);
  assert.equal(r?.method, 'sendMessage');
  assert.equal(r?.chat_id, 42);
  assert.deepEqual(r?.reply_markup?.inline_keyboard[0][0].url, 'https://t.me/tutornvl_bot?startapp=i_AbCdEfGh12345678');
});

test('/start без кода → кнопка web_app на приложение', () => {
  const r = handleUpdate(msg('/start'), cfg);
  assert.deepEqual(r?.reply_markup?.inline_keyboard[0][0].web_app, { url: cfg.appUrl });
});

test('/start с мусором вместо кода — как обычный /start', () => {
  const r = handleUpdate(msg('/start <b>x</b>'), cfg);
  assert.equal(r?.reply_markup?.inline_keyboard[0][0].url, undefined);
});

test('/help@tutornvl_bot тоже понимаем', () => {
  assert.match(handleUpdate(msg('/help@tutornvl_bot'), cfg)?.text ?? '', /AI-тьютор/);
});

test('в группе бот молчит', () => {
  assert.equal(handleUpdate(msg('/start', 'group'), cfg), null);
});

test('обновление без сообщения — без ответа', () => {
  assert.equal(handleUpdate({ edited_message: {} }, cfg), null);
  assert.equal(handleUpdate(null, cfg), null);
});

test('вебхук без секрета → 401', async () => {
  process.env.TG_WEBHOOK_SECRET = 'test_secret_value';
  const res = await route(
    new Request('http://localhost/api/bot', { method: 'POST', body: JSON.stringify(msg('/start')) }),
  );
  assert.equal(res.status, 401);
});

test('вебхук с секретом → 200 и sendMessage в ответе', async () => {
  process.env.TG_WEBHOOK_SECRET = 'test_secret_value';
  const res = await route(
    new Request('http://localhost/api/bot', {
      method: 'POST',
      headers: { 'x-telegram-bot-api-secret-token': 'test_secret_value' },
      body: JSON.stringify(msg('/start')),
    }),
  );
  assert.equal(res.status, 200);
  assert.equal(((await res.json()) as { method: string }).method, 'sendMessage');
});

test('/api/me без initData → 401', async () => {
  process.env.BOT_TOKEN = '123456789:TEST_ONLY_not_a_real_token';
  const res = await route(new Request('http://localhost/api/me'));
  assert.equal(res.status, 401);
});

test('/api/me без BOT_TOKEN → 503 not_configured', async () => {
  delete process.env.BOT_TOKEN;
  const res = await route(new Request('http://localhost/api/me'));
  assert.equal(res.status, 503);
});
