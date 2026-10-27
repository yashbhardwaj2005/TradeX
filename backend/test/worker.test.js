import { before, after, beforeEach, test } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { randomUUID } from 'node:crypto';
import { setup, teardown } from './helpers.js';
let app, user, token, models, trading, alerts, market, price;
const input = {
  symbol: 'RELIANCE.NSE',
  side: 'BUY',
  quantity: 2,
  orderType: 'LIMIT',
  limitPrice: 140000,
};
before(async () => {
  app = await setup();
  models = await import('../src/models/index.js');
  trading = await import('../src/services/trading.service.js');
  alerts = await import('../src/services/alerts.service.js');
  market = await import('../src/services/market.service.js');
});
after(teardown);
function setPrice(value) {
  price = value;
  market.setMarketProvider({
    quote: async () => ({
      price,
      timestamp: new Date().toISOString(),
      source: 'simulated',
      isSimulated: true,
    }),
  });
}
beforeEach(async () => {
  for (const name of [
    'User',
    'Holding',
    'Order',
    'Transaction',
    'PriceAlert',
    'Notification',
    'TokenSession',
    'Watchlist',
    'Snapshot',
  ])
    await models[name].deleteMany({});
  const res = await request(app)
    .post('/api/v1/auth/register')
    .send({ fullName: 'Worker User', email: 'worker@example.com', password: 'a-secure-password' });
  user = res.body.data.user;
  token = res.body.data.accessToken;
  setPrice(150000);
});
test('buy limits wait then fill exactly once under competing worker evaluations', async () => {
  const o = await trading.submitOrder(user.id, input, randomUUID());
  assert.equal(await trading.evaluatePendingOrder(o._id), null);
  setPrice(139000);
  await Promise.all([
    trading.evaluatePendingOrder(o._id),
    trading.evaluatePendingOrder(o._id),
    trading.evaluatePendingOrder(o._id),
  ]);
  assert.equal((await models.Order.findById(o._id)).status, 'FILLED');
  assert.equal(await models.Transaction.countDocuments({}), 1);
  assert.equal((await models.User.findById(user.id)).virtualBalance, 99722000);
});
test('sell limits execute only at or above target', async () => {
  await trading.submitOrder(
    user.id,
    { ...input, orderType: 'MARKET', limitPrice: undefined },
    randomUUID(),
  );
  const sell = await trading.submitOrder(
    user.id,
    { ...input, side: 'SELL', limitPrice: 160000 },
    randomUUID(),
  );
  assert.equal(await trading.evaluatePendingOrder(sell._id), null);
  setPrice(161000);
  assert.equal((await trading.evaluatePendingOrder(sell._id)).status, 'FILLED');
  assert.equal(await models.Holding.countDocuments({}), 0);
});
test('resources are revalidated and rejection has no financial side effects', async () => {
  const o = await trading.submitOrder(user.id, { ...input, quantity: 600 }, randomUUID());
  await trading.submitOrder(
    user.id,
    { ...input, orderType: 'MARKET', quantity: 600, limitPrice: undefined },
    randomUUID(),
  );
  setPrice(139000);
  const result = await trading.evaluatePendingOrder(o._id);
  assert.equal(result.status, 'REJECTED');
  assert.match(result.rejectionReason, /funds/);
  assert.equal(await models.Transaction.countDocuments({}), 1);
});
test('cancel/fill races have one consistent final outcome', async () => {
  const o = await trading.submitOrder(user.id, input, randomUUID());
  setPrice(139000);
  await Promise.allSettled([
    trading.cancelOrder(user.id, o._id),
    trading.evaluatePendingOrder(o._id),
  ]);
  const final = await models.Order.findById(o._id);
  assert.ok(['CANCELLED', 'FILLED'].includes(final.status));
  assert.equal(await models.Transaction.countDocuments({}), final.status === 'FILLED' ? 1 : 0);
});
test('one-time alerts create one notification under concurrent evaluations', async () => {
  const a = await alerts.createAlert(user.id, {
    symbol: 'RELIANCE.NSE',
    condition: 'GTE',
    targetPrice: 160000,
  });
  assert.equal(await alerts.evaluateAlert(a._id), null);
  setPrice(161000);
  await Promise.all([
    alerts.evaluateAlert(a._id),
    alerts.evaluateAlert(a._id),
    alerts.evaluateAlert(a._id),
  ]);
  assert.equal(await models.Notification.countDocuments({}), 1);
  assert.equal((await models.PriceAlert.findById(a._id)).isActive, false);
  const notification = await models.Notification.findOne({});
  assert.match(notification.message, /Simulated/);
  await alerts.markRead(user.id, notification._id);
  assert.ok((await models.Notification.findById(notification._id)).readAt);
});
test('alert ownership and stale data are enforced', async () => {
  const a = await alerts.createAlert(user.id, {
    symbol: 'RELIANCE.NSE',
    condition: 'LTE',
    targetPrice: 140000,
  });
  await assert.rejects(alerts.deleteAlert('000000000000000000000001', a._id), {
    code: 'ALERT_NOT_FOUND',
  });
  market.setMarketProvider({
    quote: async () => ({
      price: 100000,
      timestamp: new Date(0).toISOString(),
      source: 'simulated',
    }),
  });
  await assert.rejects(alerts.evaluateAlert(a._id), { code: 'STALE_QUOTE' });
  assert.equal((await models.PriceAlert.findById(a._id)).isActive, true);
  assert.equal(await models.Notification.countDocuments({}), 0);
});
