import assert from 'node:assert/strict';
import { test } from 'node:test';
import { signInitData, verifyInitData } from '../api/_lib/auth';

// Тестовый токен — не настоящий бот
const BOT_TOKEN = '123456789:TEST_ONLY_not_a_real_token';
const NOW = Date.UTC(2026, 9, 13, 12, 0, 0);
const AUTH_DATE = String(Math.floor(NOW / 1000) - 60);

function initData(fields: Record<string, string>, token = BOT_TOKEN): string {
  const params = new URLSearchParams(fields);
  params.set('hash', signInitData(fields, token));
  return params.toString();
}

const base = {
  auth_date: AUTH_DATE,
  query_id: 'AAHdF6IQAAAAAN0XohDhrOrc',
  user: JSON.stringify({ id: 279058397, first_name: 'Тест', language_code: 'kk' }),
  start_param: 'grp_abc123',
};

test('верная подпись → студент по user.id, язык и start_param', () => {
  const result = verifyInitData(initData(base), BOT_TOKEN, NOW);
  assert.deepEqual(result, {
    ok: true,
    identity: { telegramUserId: 279058397, languageCode: 'kk', startParam: 'grp_abc123', authDate: Number(AUTH_DATE) },
  });
});

test('нет initData → missing', () => {
  assert.deepEqual(verifyInitData('', BOT_TOKEN, NOW), { ok: false, reason: 'missing' });
  assert.deepEqual(verifyInitData(null, BOT_TOKEN, NOW), { ok: false, reason: 'missing' });
});

test('подменили user.id → bad_hash', () => {
  const params = new URLSearchParams(initData(base));
  params.set('user', JSON.stringify({ id: 1, first_name: 'Чужой' }));
  assert.deepEqual(verifyInitData(params.toString(), BOT_TOKEN, NOW), { ok: false, reason: 'bad_hash' });
});

test('подписано другим ботом → bad_hash', () => {
  const foreign = initData(base, '987654321:OTHER_TEST_token');
  assert.deepEqual(verifyInitData(foreign, BOT_TOKEN, NOW), { ok: false, reason: 'bad_hash' });
});

test('нет hash или hash не hex → bad_hash', () => {
  assert.deepEqual(verifyInitData(new URLSearchParams(base).toString(), BOT_TOKEN, NOW), {
    ok: false,
    reason: 'bad_hash',
  });
  const params = new URLSearchParams(base);
  params.set('hash', 'zz');
  assert.deepEqual(verifyInitData(params.toString(), BOT_TOKEN, NOW), { ok: false, reason: 'bad_hash' });
});

test('старше 24 часов → expired', () => {
  const old = { ...base, auth_date: String(Math.floor(NOW / 1000) - 25 * 60 * 60) };
  assert.deepEqual(verifyInitData(initData(old), BOT_TOKEN, NOW), { ok: false, reason: 'expired' });
});

test('auth_date из будущего → expired', () => {
  const future = { ...base, auth_date: String(Math.floor(NOW / 1000) + 600) };
  assert.deepEqual(verifyInitData(initData(future), BOT_TOKEN, NOW), { ok: false, reason: 'expired' });
});

test('нет user или id не число → bad_user', () => {
  const { user: _user, ...withoutUser } = base;
  assert.deepEqual(verifyInitData(initData(withoutUser), BOT_TOKEN, NOW), { ok: false, reason: 'bad_user' });
  const badId = { ...base, user: JSON.stringify({ id: '279058397' }) };
  assert.deepEqual(verifyInitData(initData(badId), BOT_TOKEN, NOW), { ok: false, reason: 'bad_user' });
});

test('без start_param → startParam не задан', () => {
  const { start_param: _sp, ...rest } = base;
  const result = verifyInitData(initData(rest), BOT_TOKEN, NOW);
  assert.equal(result.ok && result.identity.startParam, undefined);
});

test('пустой токен бота → no_token, даже с «верной» для него подписью', () => {
  assert.deepEqual(verifyInitData(initData(base, ''), '', NOW), { ok: false, reason: 'no_token' });
});
