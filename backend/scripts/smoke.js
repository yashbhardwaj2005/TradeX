import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
const origin = process.env.SMOKE_ORIGIN || 'http://127.0.0.1:5173';
let token, cookie;
async function call(method, path, data, extra = {}) {
  const response = await fetch(`${origin}/api/v1${path}`, {
    method,
    headers: {
      ...(data ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(cookie ? { Cookie: cookie } : {}),
      ...extra,
    },
    ...(data ? { body: JSON.stringify(data) } : {}),
  });
  const body = await response.json();
  if (response.headers.get('set-cookie')) cookie = response.headers.get('set-cookie').split(';')[0];
  assert.ok(response.ok, `${method} ${path}: ${JSON.stringify(body)}`);
  assert.equal(body.success, true);
  return body.data;
}
const html = await fetch(origin);
assert.equal(html.status, 200);
assert.match(await html.text(), /TradeX/);
const credentials = {
  fullName: 'Local QA Trader',
  email: `qa-${randomUUID()}@example.test`,
  password: randomUUID(),
};
const registered = await call('POST', '/auth/register', credentials);
assert.equal(registered.accessToken, undefined);
assert.equal(cookie, undefined);
const account = await call('POST', '/auth/login', {
  email: credentials.email,
  password: credentials.password,
});
token = account.accessToken;
assert.equal((await call('GET', '/auth/me')).virtualBalance, 100000000);
const stocks = await call('GET', '/stocks');
assert.equal(stocks.length, 16);
assert.ok(stocks.every((s) => s.isSimulated));
for (const symbol of ['RELIANCE.NSE', 'TCS.NSE', 'HDFCBANK.NSE']) {
  const payload = { symbol, side: 'BUY', orderType: 'MARKET', quantity: 3 };
  const key = randomUUID();
  const first = await call('POST', '/orders', payload, { 'Idempotency-Key': key });
  const replay = await call('POST', '/orders', payload, { 'Idempotency-Key': key });
  assert.equal(first._id, replay._id);
  await call('POST', '/watchlist', { symbol });
}
await call(
  'POST',
  '/trades/sell',
  { symbol: 'RELIANCE.NSE', quantity: 1, orderType: 'MARKET' },
  { 'Idempotency-Key': randomUUID() },
);
const p = await call('GET', '/portfolio');
assert.equal(p.holdings.length, 3);
assert.equal(p.equity, p.cash + p.holdingsValue);
assert.equal(p.totalPnL, p.realizedPnL + p.unrealizedPnL);
assert.equal((await call('GET', '/transactions')).total, 4);
assert.equal((await call('GET', '/watchlist')).symbols.length, 3);
const pending = await call(
  'POST',
  '/orders',
  { symbol: 'RELIANCE.NSE', side: 'BUY', orderType: 'LIMIT', quantity: 1, limitPrice: 1 },
  { 'Idempotency-Key': randomUUID() },
);
assert.equal(pending.status, 'PENDING');
assert.equal((await call('DELETE', `/orders/${pending._id}`)).status, 'CANCELLED');
await call('POST', '/alerts', { symbol: 'RELIANCE.NSE', condition: 'GTE', targetPrice: 1 });
const deadline = Date.now() + 45000;
let notifications = [];
while (Date.now() < deadline) {
  notifications = await call('GET', '/notifications');
  if (notifications.length) break;
  await new Promise((resolve) => setTimeout(resolve, 1000));
}
assert.equal(notifications.length, 1);
await call('PATCH', `/notifications/${notifications[0]._id}/read`);
const rotated = await call('POST', '/auth/refresh');
assert.ok(rotated.accessToken);
token = rotated.accessToken;
await call('POST', '/auth/logout');
console.log(
  'PASS: Vite proxy → Express → MongoDB; registration, auth, quote/history source, buy/sell, idempotency, accounting, watchlist, cancellation, real background alert evaluation, notifications, refresh and logout.',
);
console.log(
  'Disposable QA account retained in local development database. No credentials are printed.',
);
