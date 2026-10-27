import { test } from 'node:test';
import assert from 'node:assert/strict';
import './helpers.js';
const { SimulatedProvider, setMarketProvider, executableQuote, getHistory } =
  await import('../src/services/market.service.js');
test('stock search matches symbol and company name', async () => {
  const provider = new SimulatedProvider();
  assert.equal((await provider.search('reliance'))[0].symbol, 'RELIANCE.NSE');
  assert.equal((await provider.search('consultancy'))[0].symbol, 'TCS.NSE');
});
test('quotes explicitly label simulation with integer prices and timestamps', async () => {
  const q = await executableQuote('RELIANCE.NSE');
  assert.equal(q.isSimulated, true);
  assert.equal(q.source, 'simulated');
  assert.ok(Number.isSafeInteger(q.price));
  assert.ok(Date.now() - Date.parse(q.timestamp) < 20000);
});
test('invalid symbols fail instead of returning invented quotes', async () => {
  await assert.rejects(executableQuote('MISSING.NSE'), { code: 'SYMBOL_NOT_FOUND' });
});
test('synthetic OHLC history has ordered valid candles', async () => {
  const h = await getHistory('TCS.NSE', '1M');
  assert.equal(h.source, 'simulated');
  assert.ok(h.candles.length > 15);
  for (let i = 0; i < h.candles.length; i++) {
    const c = h.candles[i];
    assert.ok(c.high >= Math.max(c.open, c.close));
    assert.ok(c.low <= Math.min(c.open, c.close));
    if (i) assert.ok(c.time > h.candles[i - 1].time);
  }
});
test('stale or invalid executable quotes are rejected', async () => {
  setMarketProvider({ quote: async () => ({ price: 100, timestamp: new Date(0).toISOString() }) });
  await assert.rejects(executableQuote('RELIANCE.NSE'), { code: 'STALE_QUOTE' });
  setMarketProvider({ quote: async () => ({ price: NaN, timestamp: new Date().toISOString() }) });
  await assert.rejects(executableQuote('TCS.NSE'), { code: 'INVALID_QUOTE' });
  setMarketProvider(new SimulatedProvider());
});
