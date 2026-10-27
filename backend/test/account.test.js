import { before, after, test } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { randomUUID } from 'node:crypto';
import { setup, teardown, registerAndLogin } from './helpers.js';
let app, a, b, order;
before(async () => {
  app = await setup();
  for (const email of ['a@example.com', 'b@example.com']) {
    const r = await registerAndLogin(app, {
      fullName: 'Account Test',
      email,
      password: 'a-secure-password',
    });
    if (!a) a = r.body.data;
    else b = r.body.data;
  }
});
after(teardown);
const api = (method, path, token = a.accessToken) =>
  request(app)[method](`/api/v1${path}`).auth(token, { type: 'bearer' });
test('watchlists prevent duplicates and isolate owners', async () => {
  for (let i = 0; i < 2; i++)
    assert.equal((await api('post', '/watchlist').send({ symbol: 'TCS.NSE' })).status, 201);
  assert.deepEqual((await api('get', '/watchlist')).body.data.symbols, ['TCS.NSE']);
  assert.deepEqual((await api('get', '/watchlist', b.accessToken)).body.data.symbols, []);
  await api('delete', '/watchlist/TCS.NSE', b.accessToken);
  assert.equal((await api('get', '/watchlist')).body.data.symbols.length, 1);
  await api('delete', '/watchlist/TCS.NSE');
  assert.equal((await api('get', '/watchlist')).body.data.symbols.length, 0);
});
test('orders paginate and filter while hiding other users', async () => {
  for (let i = 0; i < 3; i++) {
    const r = await api('post', '/orders')
      .set('Idempotency-Key', randomUUID())
      .send({ symbol: 'TCS.NSE', side: 'BUY', orderType: 'LIMIT', quantity: 1, limitPrice: 1 });
    assert.equal(r.status, 201);
    order = r.body.data;
  }
  const r = await api('get', '/orders?limit=2&page=2&status=PENDING&sort=asc');
  assert.equal(r.body.data.total, 3);
  assert.equal(r.body.data.items.length, 1);
  assert.equal((await api('get', '/orders', b.accessToken)).body.data.total, 0);
  assert.equal((await api('get', `/orders/${order._id}`, b.accessToken)).status, 404);
});
test('pending orders cancel exactly once and cannot fill after cancellation', async () => {
  assert.equal((await api('delete', `/orders/${order._id}`)).body.data.status, 'CANCELLED');
  assert.equal((await api('delete', `/orders/${order._id}`)).status, 409);
  const { evaluatePendingOrder } = await import('../src/services/trading.service.js');
  assert.equal(await evaluatePendingOrder(order._id), null);
});
test('profile update cannot change private account money', async () => {
  assert.equal(
    (
      await api('patch', '/auth/profile').send({
        fullName: 'Updated Name',
        virtualBalance: 999999999,
      })
    ).status,
    400,
  );
  const r = await api('patch', '/auth/profile').send({ fullName: 'Updated Name' });
  assert.equal(r.status, 200);
  assert.equal(r.body.data.fullName, 'Updated Name');
  assert.equal(r.body.data.virtualBalance, 100000000);
});
test('date ranges and pagination are validated', async () => {
  assert.equal((await api('get', '/orders?page=-1')).status, 400);
  assert.equal((await api('get', '/orders?from=2026-10-27&to=2026-01-01')).status, 400);
  assert.equal((await api('get', '/transactions', b.accessToken)).body.data.items.length, 0);
});
