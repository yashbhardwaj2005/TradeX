import { before, after, test } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { randomUUID } from 'node:crypto';
import { setup, teardown } from './helpers.js';
let app, token, user, trading, portfolio, market;
before(async () => {
  app = await setup();
  trading = await import('../src/services/trading.service.js');
  portfolio = await import('../src/services/portfolio.service.js');
  market = await import('../src/services/market.service.js');
  const res = await request(app).post('/api/v1/auth/register').send({
    fullName: 'Portfolio User',
    email: 'portfolio@example.com',
    password: 'a-secure-password',
  });
  token = res.body.data.accessToken;
  user = res.body.data.user;
});
after(teardown);
test('new accounts have cash and a genuine initial snapshot', async () => {
  const p = await portfolio.getAnalytics(user.id);
  assert.equal(p.equity, 100000000);
  assert.equal(p.holdings.length, 0);
  assert.equal(p.returnPercent, 0);
  assert.equal(p.snapshots.length, 1);
});
test('portfolio satisfies accounting identities after buys, repricing and sales', async () => {
  market.setMarketProvider({
    quote: async () => ({
      price: 150000,
      name: 'Reliance',
      sector: 'Energy',
      source: 'simulated',
      timestamp: new Date().toISOString(),
    }),
  });
  await trading.submitOrder(
    user.id,
    { symbol: 'RELIANCE.NSE', side: 'BUY', quantity: 5, orderType: 'MARKET' },
    randomUUID(),
  );
  market.setMarketProvider({
    quote: async () => ({
      price: 160000,
      name: 'Reliance',
      sector: 'Energy',
      source: 'simulated',
      timestamp: new Date().toISOString(),
    }),
  });
  await trading.submitOrder(
    user.id,
    { symbol: 'RELIANCE.NSE', side: 'SELL', quantity: 2, orderType: 'MARKET' },
    randomUUID(),
  );
  const p = await portfolio.getPortfolio(user.id);
  assert.equal(p.cash, 99570000);
  assert.equal(p.holdingsValue, 480000);
  assert.equal(p.totalInvested, 450000);
  assert.equal(p.realizedPnL, 20000);
  assert.equal(p.unrealizedPnL, 30000);
  assert.equal(p.totalPnL, 50000);
  assert.equal(p.equity, p.cash + p.holdingsValue);
  assert.equal(p.totalPnL, p.realizedPnL + p.unrealizedPnL);
  assert.equal(
    p.allocation.reduce((s, a) => s + a.value, 0),
    p.equity,
  );
});
test('portfolio routes are private and cannot select another user', async () => {
  assert.equal((await request(app).get('/api/v1/portfolio')).status, 401);
  const p = await request(app)
    .get('/api/v1/portfolio?userId=000000000000000000000000')
    .auth(token, { type: 'bearer' });
  assert.equal(p.status, 200);
  assert.equal(p.body.data.holdings.length, 1);
});
test('snapshots record actual values once per interval', async () => {
  await portfolio.recordSnapshot(user.id);
  await portfolio.recordSnapshot(user.id);
  const p = await portfolio.getAnalytics(user.id);
  assert.equal(p.snapshots.length, 2);
  assert.equal(p.snapshots[1].equity, 100050000);
});
