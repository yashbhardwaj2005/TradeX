import { before, after, test } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { randomUUID } from 'node:crypto';
import { setup, teardown } from './helpers.js';
process.env.WORKER_ENABLED = 'false';
let app, token;
before(async () => {
  app = await setup();
  const res = await request(app)
    .post('/api/v1/auth/register')
    .send({ fullName: 'No Worker', email: 'no-worker@example.com', password: 'a-secure-password' });
  token = res.body.data.accessToken;
});
after(teardown);
test('disabled worker is exposed and limit orders are refused', async () => {
  assert.equal((await request(app).get('/api/v1/config')).body.data.workerEnabled, false);
  const r = await request(app)
    .post('/api/v1/orders')
    .auth(token, { type: 'bearer' })
    .set('Idempotency-Key', randomUUID())
    .send({ symbol: 'TCS.NSE', side: 'BUY', orderType: 'LIMIT', quantity: 1, limitPrice: 1 });
  assert.equal(r.status, 503);
  assert.equal(r.body.error.code, 'WORKER_DISABLED');
});
test('disabled worker refuses alerts without pretending to watch prices', async () => {
  const r = await request(app)
    .post('/api/v1/alerts')
    .auth(token, { type: 'bearer' })
    .send({ symbol: 'TCS.NSE', condition: 'GTE', targetPrice: 1 });
  assert.equal(r.status, 503);
  assert.equal(r.body.error.code, 'WORKER_DISABLED');
});
