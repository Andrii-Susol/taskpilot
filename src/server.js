import http from 'node:http';
import { createApp } from './app.js';
import { createRateLimiter } from './middleware/rate-limit.js';

const port = Number(process.env.PORT ?? 3000);
const rateLimiter = createRateLimiter({
  capacity: Number(process.env.RATE_LIMIT_CAPACITY ?? 60),
  refillPerSecond: Number(process.env.RATE_LIMIT_REFILL_PER_SEC ?? 1),
});
const server = http.createServer(createApp({ rateLimiter }));

server.listen(port, () => {
  console.log(`TaskPilot listening on http://localhost:${port}`);
});

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => server.close(() => process.exit(0)));
}
