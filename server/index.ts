// Свой сервер (docs/production.md): тот же маршрутизатор, что на Vercel, поверх node:http.
// Статику app/ отдаёт Caddy, сюда приходит только /api/*.
//
//   npm run build:server && DATABASE_URL=… npm start

import { createServer, type IncomingMessage } from 'node:http';
import { closeDb } from '../api/_lib/db';
import { json } from '../api/_lib/http';
import { route } from '../api/_lib/router';

const PORT = Number(process.env.PORT ?? 3000);
const MAX_BODY_BYTES = 1024 * 1024;

class BodyTooLarge extends Error {}

async function readBody(req: IncomingMessage): Promise<Buffer> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of req) {
    size += (chunk as Buffer).length;
    if (size > MAX_BODY_BYTES) throw new BodyTooLarge();
    chunks.push(chunk as Buffer);
  }
  return Buffer.concat(chunks);
}

function toHeaders(req: IncomingMessage): Headers {
  const headers = new Headers();
  for (const [name, value] of Object.entries(req.headers)) {
    if (Array.isArray(value)) value.forEach((v) => headers.append(name, v));
    else if (value !== undefined) headers.set(name, value);
  }
  return headers;
}

const server = createServer(async (req, res) => {
  let response: Response;
  try {
    const method = req.method ?? 'GET';
    const hasBody = method !== 'GET' && method !== 'HEAD';
    const request = new Request(`http://${req.headers.host ?? 'localhost'}${req.url ?? '/'}`, {
      method,
      headers: toHeaders(req),
      body: hasBody ? new Uint8Array(await readBody(req)) : undefined,
    });
    response = await route(request);
  } catch (error) {
    response =
      error instanceof BodyTooLarge
        ? json(413, { error: 'payload_too_large' })
        : json(400, { error: 'bad_request' });
  }

  res.writeHead(response.status, Object.fromEntries(response.headers));
  res.end(Buffer.from(await response.arrayBuffer()));
});

server.listen(PORT, () => console.log(`api: порт ${PORT}`));

for (const signal of ['SIGTERM', 'SIGINT'] as const) {
  process.on(signal, () => {
    server.close(() => {
      closeDb().finally(() => process.exit(0));
    });
  });
}
