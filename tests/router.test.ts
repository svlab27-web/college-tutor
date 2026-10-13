import assert from 'node:assert/strict';
import { test } from 'node:test';
import { route } from '../api/_lib/router';

test('GET /api/health без DATABASE_URL → 503 not_configured', async () => {
  delete process.env.DATABASE_URL;
  const res = await route(new Request('http://localhost/api/health'));
  assert.equal(res.status, 503);
  assert.equal(res.headers.get('cache-control'), 'no-store');
  const body = (await res.json()) as { ok: boolean; db: string };
  assert.equal(body.ok, false);
  assert.equal(body.db, 'not_configured');
});

test('слэш в конце пути не мешает', async () => {
  delete process.env.DATABASE_URL;
  const res = await route(new Request('http://localhost/api/health/'));
  assert.equal(res.status, 503);
});

test('неизвестный путь → 404', async () => {
  const res = await route(new Request('http://localhost/api/nope'));
  assert.equal(res.status, 404);
  assert.deepEqual(await res.json(), { error: 'not_found' });
});

test('не тот метод → 405 и заголовок Allow', async () => {
  const res = await route(new Request('http://localhost/api/health', { method: 'POST' }));
  assert.equal(res.status, 405);
  assert.equal(res.headers.get('allow'), 'GET');
});
