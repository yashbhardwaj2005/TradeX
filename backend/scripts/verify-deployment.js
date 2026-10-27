import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
import { randomBytes, randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
const root = fileURLToPath(new URL('../../', import.meta.url));
const replica = await MongoMemoryReplSet.create({
  replSet: { count: 1, storageEngine: 'wiredTiger' },
});
const socket = createServer();
await new Promise((resolve) => socket.listen(0, '127.0.0.1', resolve));
const port = socket.address().port;
await new Promise((resolve) => socket.close(resolve));
const origin = `http://127.0.0.1:${port}`;
let diagnostics = '';
const child = spawn(process.execPath, ['backend/scripts/start-full.js'], {
  cwd: root,
  windowsHide: true,
  stdio: ['ignore', 'pipe', 'pipe'],
  env: {
    ...process.env,
    NODE_ENV: 'production',
    PORT: String(port),
    MONGODB_URI: replica.getUri('tradex_deployment_test'),
    JWT_ACCESS_SECRET: randomBytes(48).toString('hex'),
    JWT_REFRESH_SECRET: randomBytes(48).toString('hex'),
    COOKIE_SECURE: 'true',
    COOKIE_SAME_SITE: 'lax',
    CLIENT_ORIGINS: 'https://tradex.example',
    PUBLIC_APP_URL: 'https://tradex.example',
    SERVE_FRONTEND: 'true',
    WORKER_ENABLED: 'false',
    TRUST_PROXY: '0',
  },
});
child.stdout.on('data', (chunk) => {
  diagnostics += chunk;
});
child.stderr.on('data', (chunk) => {
  diagnostics += chunk;
});
try {
  const deadline = Date.now() + 15000;
  for (;;) {
    if (child.exitCode !== null) throw new Error(`Production server exited: ${diagnostics}`);
    try {
      const health = await fetch(`${origin}/api/health`, { signal: AbortSignal.timeout(1000) });
      if (health.ok) break;
    } catch {}
    if (Date.now() >= deadline)
      throw new Error(`Production server did not become ready: ${diagnostics}`);
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  const html = await (await fetch(origin)).text();
  assert.match(html, /<title>TradeX/);
  const script = html.match(/src="(\/assets\/[^\"]+\.js)"/)?.[1];
  assert.ok(script, 'The built entry point must be linked from the served HTML');
  const asset = await fetch(`${origin}${script}`);
  assert.equal(asset.status, 200);
  assert.match(asset.headers.get('content-type'), /javascript/);
  assert.equal((await fetch(`${origin}/favicon.svg`)).status, 200);
  assert.match(await (await fetch(`${origin}/stocks/RELIANCE.NSE`)).text(), /<title>TradeX/);
  const missing = await fetch(`${origin}/api/unknown`);
  assert.equal(missing.status, 404);
  assert.match(missing.headers.get('content-type'), /json/);
  const password = randomUUID();
  const registration = await fetch(`${origin}/api/v1/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Origin: 'https://tradex.example' },
    body: JSON.stringify({
      fullName: 'Deployment Check',
      email: 'deployment@example.test',
      password,
    }),
  });
  assert.equal(registration.status, 201);
  assert.equal(registration.headers.get('set-cookie'), null);
  assert.equal((await registration.json()).data.accessToken, undefined);
  const login = await fetch(`${origin}/api/v1/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Origin: 'https://tradex.example' },
    body: JSON.stringify({ email: 'deployment@example.test', password }),
  });
  assert.equal(login.status, 200);
  assert.match(login.headers.get('set-cookie'), /HttpOnly/);
  assert.match(login.headers.get('set-cookie'), /Secure/);
  assert.match(login.headers.get('set-cookie'), /SameSite=Lax/);
  const session = (await login.json()).data;
  const headers = {
    'Content-Type': 'application/json',
    Origin: 'https://tradex.example',
    Authorization: `Bearer ${session.accessToken}`,
    'Idempotency-Key': randomUUID(),
  };
  const buy = await fetch(`${origin}/api/v1/orders`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ symbol: 'RELIANCE.NSE', side: 'BUY', orderType: 'MARKET', quantity: 1 }),
  });
  assert.equal(buy.status, 201);
  assert.equal((await buy.json()).data.status, 'FILLED');
  const config = (await (await fetch(`${origin}/api/v1/config`)).json()).data;
  assert.equal(config.workerEnabled, false);
  const limit = await fetch(`${origin}/api/v1/orders`, {
    method: 'POST',
    headers: { ...headers, 'Idempotency-Key': randomUUID() },
    body: JSON.stringify({
      symbol: 'RELIANCE.NSE',
      side: 'BUY',
      orderType: 'LIMIT',
      quantity: 1,
      limitPrice: 1,
    }),
  });
  assert.equal(limit.status, 503);
  assert.equal((await limit.json()).error.code, 'WORKER_DISABLED');
  console.log(
    'PASS: production entry point serves TradeX, bundled JS, favicon, NSE deep links and JSON API errors; registration requires a separate secure-cookie login, and a virtual buy works with the free-deployment worker disabled.',
  );
} finally {
  if (child.exitCode === null) {
    const exited = new Promise((resolve) => child.once('exit', resolve));
    child.kill();
    await exited;
  }
  await replica.stop();
}
