// HTTP request handler: body parsing, routing and error handling.
import { createRouter } from './router.js';
import { createStore, ValidationError } from './store.js';
import { registerTaskRoutes } from './routes/tasks.js';

const MAX_BODY_BYTES = 1_000_000;

function readBody(req) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on('data', (chunk) => {
      size += chunk.length;
      if (size > MAX_BODY_BYTES) {
        reject(new Error('Body too large'));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

function send(res, status, body) {
  if (body === null || body === undefined) {
    res.writeHead(status);
    res.end();
    return;
  }
  const payload = JSON.stringify(body);
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'content-length': Buffer.byteLength(payload),
  });
  res.end(payload);
}

export function createApp({ store = createStore(), rateLimiter = null, exempt = ['/health'] } = {}) {
  const router = createRouter();
  registerTaskRoutes(router, store);

  return async function handler(req, res) {
    const url = new URL(req.url, 'http://localhost');
    try {
      if (rateLimiter && !exempt.includes(url.pathname)) {
        const verdict = rateLimiter(req);
        res.setHeader('x-ratelimit-limit', verdict.limit);
        res.setHeader('x-ratelimit-remaining', verdict.remaining);
        if (!verdict.allowed) {
          res.setHeader('retry-after', verdict.retryAfterSeconds);
          return send(res, 429, { error: 'Too many requests' });
        }
      }
      const { handler: route, params, methodNotAllowed } = router.match(req.method, url.pathname);
      if (!route) {
        return send(res, methodNotAllowed ? 405 : 404, { error: methodNotAllowed ? 'Method not allowed' : 'Not found' });
      }
      const raw = ['POST', 'PATCH', 'PUT'].includes(req.method) ? await readBody(req) : '';
      let body;
      if (raw) {
        try {
          body = JSON.parse(raw);
        } catch (err) {
          if (err instanceof SyntaxError) {
            return send(res, 400, { error: 'Malformed JSON body' });
          }
          throw err;
        }
      }
      const result = await route({ req, params, query: url.searchParams, body });
      return send(res, result.status, result.body);
    } catch (err) {
      if (err instanceof ValidationError) {
        return send(res, 400, { error: err.message });
      }
      return send(res, 500, { error: 'Internal Server Error' });
    }
  };
}