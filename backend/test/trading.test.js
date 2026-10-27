import { before, after, beforeEach, test } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { randomUUID } from 'node:crypto';
import { setup, teardown, registerAndLogin } from './helpers.js';
let app, user, token, models, market, trading;
let price = 150000;
const order = (side = 'BUY', quantity = 5) => ({
  symbol: 'RELIANCE.NSE',
  side,
  quantity,
  orderType: 'MARKET',
});
before(async () => {
  app = await setup();
  models = await import('../src/models/index.js');
  market = await import('../src/services/market.service.js');
  trading = await import('../src/services/trading.service.js');
});
after(teardown);
beforeEach(async () => {
  for (const name of [
    'User',
    'Holding',
    'Order',
    'Transaction',
    'TokenSession',
    'Watchlist',
    'Snapshot',
  ])
    await models[name].deleteMany({});
  price = 150000;
  market.setMarketProvider({
    quote: async (symbol) => {
      if (symbol !== 'RELIANCE.NSE')
        throw new (await import('../src/utils/errors.js')).AppError(
          404,
          'SYMBOL_NOT_FOUND',
          'Unknown stock',
        );
      return {
        symbol,
        price,
        previousClose: 140000,
        timestamp: new Date().toISOString(),
        source: 'simulated',
        isSimulated: true,
        sector: 'Energy',
        name: 'Reliance Industries',
      };
    },
  });
  const res = await registerAndLogin(app, {
    fullName: 'Trading Test',
    email: 'trading@example.com',
    password: 'a-secure-password',
  });
  assert.equal(res.status, 200);
  user = res.body.data.user;
  token = res.body.data.accessToken;
});
test('buy atomically debits cash and creates holding and transaction', async () => {
  const o = await trading.submitOrder(user.id, order(), randomUUID());
  assert.equal(o.status, 'FILLED');
  assert.equal((await models.User.findById(user.id)).virtualBalance, 99250000);
  const h = await models.Holding.findOne({ userId: user.id });
  assert.equal(h.quantity, 5);
  assert.equal(h.costBasis, 750000);
  assert.equal(await models.Transaction.countDocuments({}), 1);
});
test('sell realizes P&L using weighted-average cost and deletes empty holdings', async () => {
  await trading.submitOrder(user.id, order(), randomUUID());
  price = 160000;
  market.setMarketProvider({
    quote: async () => ({ price, timestamp: new Date().toISOString(), source: 'simulated' }),
  });
  await trading.submitOrder(user.id, order('SELL'), randomUUID());
  assert.equal((await models.User.findById(user.id)).virtualBalance, 100050000);
  assert.equal(await models.Holding.countDocuments({}), 0);
  assert.equal((await models.Transaction.findOne({ side: 'SELL' })).realizedPnL, 50000);
});
test('weighted average cost conserves integer paise over partial sells', async () => {
  await trading.submitOrder(user.id, order('BUY', 3), randomUUID());
  price = 151001;
  market.setMarketProvider({
    quote: async () => ({ price, timestamp: new Date().toISOString(), source: 'simulated' }),
  });
  await trading.submitOrder(user.id, order('BUY', 2), randomUUID());
  let h = await models.Holding.findOne({ userId: user.id });
  assert.equal(h.costBasis, 752002);
  await trading.submitOrder(user.id, order('SELL', 2), randomUUID());
  h = await models.Holding.findOne({ userId: user.id });
  assert.equal(h.costBasis, 451201);
  const t = await models.Transaction.findOne({ side: 'SELL' });
  assert.equal(t.costBasis + h.costBasis, 752002);
  assert.equal(t.realizedPnL, 1201);
});
test('insufficient cash and overselling reject without partial writes', async () => {
  await assert.rejects(trading.submitOrder(user.id, order('BUY', 1000), randomUUID()), {
    code: 'INSUFFICIENT_FUNDS',
  });
  await assert.rejects(trading.submitOrder(user.id, order('SELL', 1), randomUUID()), {
    code: 'INSUFFICIENT_SHARES',
  });
  assert.equal((await models.User.findById(user.id)).virtualBalance, 100000000);
  assert.equal(await models.Transaction.countDocuments({}), 0);
});
test('invalid symbols and client-supplied prices are rejected', async () => {
  await assert.rejects(
    trading.submitOrder(user.id, { ...order(), symbol: 'MISSING.NSE' }, randomUUID()),
    { code: 'SYMBOL_NOT_FOUND' },
  );
  const res = await request(app)
    .post('/api/v1/orders')
    .auth(token, { type: 'bearer' })
    .set('Idempotency-Key', randomUUID())
    .send({ ...order(), executionPrice: 1 });
  assert.equal(res.status, 400);
});
test('concurrent buy requests cannot double spend', async () => {
  const results = await Promise.allSettled(
    Array.from({ length: 4 }, () => trading.submitOrder(user.id, order('BUY', 400), randomUUID())),
  );
  assert.equal(results.filter((r) => r.status === 'fulfilled').length, 1);
  assert.equal((await models.User.findById(user.id)).virtualBalance, 40000000);
  assert.equal(await models.Transaction.countDocuments({}), 1);
});
test('simultaneous duplicate requests execute once and payload conflicts fail', async () => {
  const key = randomUUID();
  const results = await Promise.all(
    Array.from({ length: 4 }, () => trading.submitOrder(user.id, order(), key)),
  );
  assert.ok(results.every((o) => String(o._id) === String(results[0]._id)));
  assert.equal(await models.Transaction.countDocuments({}), 1);
  await assert.rejects(trading.submitOrder(user.id, order('BUY', 6), key), {
    code: 'IDEMPOTENCY_CONFLICT',
  });
});
test('database failure rolls the entire trade back', async () => {
  const original = models.Transaction.create;
  models.Transaction.create = async () => {
    throw new Error('Injected database failure');
  };
  try {
    await assert.rejects(
      trading.submitOrder(user.id, order(), randomUUID()),
      /Injected database failure/,
    );
  } finally {
    models.Transaction.create = original;
  }
  assert.equal((await models.User.findById(user.id)).virtualBalance, 100000000);
  assert.equal(await models.Holding.countDocuments({}), 0);
  assert.equal(await models.Order.countDocuments({}), 0);
});
test('user ownership prevents another account selling or cancelling holdings', async () => {
  await trading.submitOrder(user.id, order(), randomUUID());
  const other = await models.User.create({
    fullName: 'Other',
    email: 'other@example.com',
    passwordHash: 'unused',
  });
  await assert.rejects(trading.submitOrder(String(other._id), order('SELL'), randomUUID()), {
    code: 'INSUFFICIENT_SHARES',
  });
  const pending = await trading.submitOrder(
    user.id,
    { ...order(), orderType: 'LIMIT', limitPrice: 140000 },
    randomUUID(),
  );
  await assert.rejects(trading.cancelOrder(String(other._id), pending._id), {
    code: 'ORDER_NOT_CANCELLABLE',
  });
});
test('simultaneous sells cannot oversell a holding', async () => {
  await trading.submitOrder(user.id, order('BUY', 5), randomUUID());
  const results = await Promise.allSettled([
    trading.submitOrder(user.id, order('SELL', 4), randomUUID()),
    trading.submitOrder(user.id, order('SELL', 4), randomUUID()),
  ]);
  assert.equal(results.filter((r) => r.status === 'fulfilled').length, 1);
  assert.equal((await models.Holding.findOne({ userId: user.id })).quantity, 1);
  assert.equal(await models.Transaction.countDocuments({ side: 'SELL' }), 1);
});
test('transient transaction errors retry without duplicate effects', async () => {
  const { default: mongoose } = await import('mongoose');
  const original = models.Transaction.create;
  let attempts = 0;
  models.Transaction.create = async function (...args) {
    if (attempts++ === 0) {
      const error = new mongoose.mongo.MongoServerError({
        message: 'Injected write conflict',
        code: 112,
      });
      error.addErrorLabel('TransientTransactionError');
      throw error;
    }
    return original.apply(this, args);
  };
  try {
    const o = await trading.submitOrder(user.id, order(), randomUUID());
    assert.equal(o.status, 'FILLED');
  } finally {
    models.Transaction.create = original;
  }
  assert.ok(attempts >= 2);
  assert.equal(await models.Transaction.countDocuments({}), 1);
  assert.equal((await models.User.findById(user.id)).virtualBalance, 99250000);
});
