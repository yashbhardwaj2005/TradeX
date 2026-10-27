import { before, after, test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import express from 'express';
import request from 'supertest';
import { attachFrontend } from '../src/middlewares/frontend.js';
let directory, app;
before(async () => {
  directory = await mkdtemp(path.join(tmpdir(), 'tradex-frontend-'));
  await mkdir(path.join(directory, 'assets'));
  await writeFile(
    path.join(directory, 'index.html'),
    '<!doctype html><title>TradeX</title><div id="root"></div>',
  );
  await writeFile(path.join(directory, 'assets', 'app-12345678.js'), 'console.log("TradeX");');
  app = express();
  app.get('/api/health', (req, res) => res.json({ success: true }));
  attachFrontend(app, directory);
  app.use((req, res) => res.status(404).json({ success: false }));
});
after(async () => {
  assert.ok(
    path.resolve(directory).startsWith(path.join(path.resolve(tmpdir()), 'tradex-frontend-')),
  );
  await rm(directory, { recursive: true, force: true });
});
test('single-service deployment serves the TradeX frontend and its assets', async () => {
  const page = await request(app).get('/');
  assert.equal(page.status, 200);
  assert.match(page.text, /TradeX/);
  assert.equal(page.headers['cache-control'], 'no-cache');
  const asset = await request(app).get('/assets/app-12345678.js');
  assert.equal(asset.status, 200);
  assert.match(asset.headers['cache-control'], /immutable/);
});
test('SPA deep links including NSE symbols return the frontend', async () => {
  for (const route of ['/portfolio', '/orders', '/stocks/RELIANCE.NSE']) {
    const page = await request(app).get(route).set('Accept', 'text/html');
    assert.equal(page.status, 200);
    assert.match(page.text, /TradeX/);
  }
});
test('API errors, missing assets and non-GET requests are never hidden by SPA fallback', async () => {
  assert.equal((await request(app).get('/api/health')).body.success, true);
  for (const route of ['/api/missing', '/assets/missing.js', '/missing.css'])
    assert.equal((await request(app).get(route).set('Accept', 'text/html')).status, 404);
  assert.equal((await request(app).post('/portfolio')).status, 404);
});
test('missing frontend build fails startup with an actionable message', () => {
  assert.throws(() => attachFrontend(express(), path.join(directory, 'missing')), /npm run build/);
});
