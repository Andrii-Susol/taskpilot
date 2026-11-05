import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { startTestServer } from './helpers.js';
import http from 'node:http';
import { createApp } from '../src/app.js';

let api;
let testServer;
let testPort;

before(async () => {
  api = await startTestServer();
  // Set up a separate test server for smoke-test.sh to connect to
  testServer = http.createServer(createApp());
  await new Promise((resolve) => testServer.listen(0, '127.0.0.1', resolve));
  testPort = testServer.address().port;
});

after(async () => {
  await api.close();
  testServer.close();
});

test('smoke-test.sh succeeds when server is running', async () => {
  return new Promise((resolve, reject) => {
    const env = { ...process.env, PORT: String(testPort) };
    const child = spawn('bash', ['scripts/smoke-test.sh'], { env, cwd: '.' });
    let output = '';
    let errorOutput = '';

    child.stdout.on('data', (data) => {
      output += data.toString();
    });

    child.stderr.on('data', (data) => {
      errorOutput += data.toString();
    });

    child.on('close', (code) => {
      if (code === 0) {
        assert(output.includes('OK'), `Expected success message in output: ${output}`);
        resolve();
      } else {
        reject(
          new Error(
            `smoke-test.sh exited with code ${code}. stdout: ${output}, stderr: ${errorOutput}`
          )
        );
      }
    });

    child.on('error', reject);
  });
});

test('smoke-test.sh fails when server does not respond (wrong port in health check)', async () => {
  return new Promise((resolve, reject) => {
    // Use a port that won't be opened by the server - the server will start but listen on testPort
    // while the health check tries to connect to a different port
    const env = { ...process.env, PORT: '0' };
    const child = spawn('bash', ['scripts/smoke-test.sh'], { env, cwd: '.' });
    let output = '';
    let errorOutput = '';

    child.stdout.on('data', (data) => {
      output += data.toString();
    });

    child.stderr.on('data', (data) => {
      errorOutput += data.toString();
    });

    child.on('close', (code) => {
      if (code === 1) {
        assert(
          errorOutput.includes('FAILED after'),
          `Expected failure message in stderr: ${errorOutput}`
        );
        resolve();
      } else {
        reject(
          new Error(
            `smoke-test.sh should fail with code 1 when server does not respond on the expected port, got ${code}`
          )
        );
      }
    });

    child.on('error', reject);
  });
});

test('seed-tasks.sh succeeds when server is running', async () => {
  return new Promise((resolve, reject) => {
    const env = { ...process.env, TASKPILOT_URL: `http://127.0.0.1:${testPort}` };
    const child = spawn('bash', ['scripts/seed-tasks.sh'], { env, cwd: '.' });
    let output = '';
    let errorOutput = '';

    child.stdout.on('data', (data) => {
      output += data.toString();
    });

    child.stderr.on('data', (data) => {
      errorOutput += data.toString();
    });

    child.on('close', (code) => {
      if (code === 0) {
        // Check that all three tasks were created
        assert(output.includes('created task'), `Expected task creation in output: ${output}`);
        resolve();
      } else {
        reject(
          new Error(
            `seed-tasks.sh exited with code ${code}. stdout: ${output}, stderr: ${errorOutput}`
          )
        );
      }
    });

    child.on('error', reject);
  });
});

test('seed-tasks.sh fails when server is not running (wrong URL)', async () => {
  return new Promise((resolve, reject) => {
    const env = { ...process.env, TASKPILOT_URL: 'http://127.0.0.1:9999' };
    const child = spawn('bash', ['scripts/seed-tasks.sh'], { env, cwd: '.' });
    let output = '';
    let errorOutput = '';

    child.stdout.on('data', (data) => {
      output += data.toString();
    });

    child.stderr.on('data', (data) => {
      errorOutput += data.toString();
    });

    child.on('close', (code) => {
      if (code === 1) {
        assert(
          errorOutput.includes('FAILED after'),
          `Expected failure message in stderr: ${errorOutput}`
        );
        resolve();
      } else {
        reject(
          new Error(
            `seed-tasks.sh should fail with code 1 when server is unavailable, got ${code}`
          )
        );
      }
    });

    child.on('error', reject);
  });
});

