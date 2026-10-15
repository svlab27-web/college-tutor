// api/index.ts: после rewrite /api/<путь> → /api?__path=<путь> маршрутизатор видит исходный путь и query.

import assert from 'node:assert/strict';
import { test } from 'node:test';
import { restorePath } from '../api/index';

test('исходный путь восстанавливается, остальные параметры сохраняются', () => {
  const r = restorePath(new Request('https://x.vercel.app/api?group_id=g1&__path=curator/students', { method: 'GET' }));
  const u = new URL(r.url);
  assert.equal(u.pathname, '/api/curator/students');
  assert.equal(u.searchParams.get('group_id'), 'g1');
  assert.equal(u.searchParams.has('__path'), false);
});

test('метод, заголовки и тело переносятся (PATCH)', async () => {
  const r = restorePath(new Request('https://x/api?__path=curator/students/abc', {
    method: 'PATCH', headers: { 'x-telegram-init-data': 'q' }, body: '{"full_name":"А Б"}',
  }));
  assert.equal(r.method, 'PATCH');
  assert.equal(r.headers.get('x-telegram-init-data'), 'q');
  assert.equal(await r.text(), '{"full_name":"А Б"}');
  assert.equal(new URL(r.url).pathname, '/api/curator/students/abc');
});

test('без __path (свой сервер, прямой вызов) — запрос не меняется', () => {
  const req = new Request('https://x/api/me');
  assert.equal(restorePath(req), req);
});
