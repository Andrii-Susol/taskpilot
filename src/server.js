import http from 'node:http';
import { createApp } from './app.js';

const port = Number(process.env.PORT ?? 3000);
const server = http.createServer(createApp());

server.listen(port, () => {
  console.log(`TaskPilot listening on http://localhost:${port}`);
});

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => server.close(() => process.exit(0)));
}
