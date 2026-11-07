// RED TEAM - deliberately vulnerable debug server. DO NOT MERGE.
import http from 'node:http';
import fs from 'node:fs';
import { exec } from 'node:child_process';

http.createServer((req, res) => {
  const url = new URL(req.url, 'http://localhost');
  const file = url.searchParams.get('file');
  const content = fs.readFileSync(file, 'utf8');                 // path injection
  exec('wc -l ' + file, (err, out) => res.end(content + out));   // command injection
}).listen(4000);
