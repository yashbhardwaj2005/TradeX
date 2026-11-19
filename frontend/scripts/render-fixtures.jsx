import assert from 'node:assert/strict';
import { renderToString } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useAuth } from '../src/store/auth';
import App from '../src/App';
import { api, restoreSession, get, connectionPollInterval } from '../src/services/api';
import { loginSchema, registrationSchema } from '../src/pages/Auth';
export async function runChecks() {
  const now = new Date().toISOString();
  const stock = {
    symbol: 'RELIANCE.NSE',
    ticker: 'RELIANCE',
    name: 'Reliance Industries',
    sector: 'Energy',
    color: '#9d92ef',
    price: 150000,
    previousClose: 149000,
    change: 1000,
    changePercent: 0.67,
    open: 149000,
    high: 151000,
    low: 148000,
    volume: 1000000,
    timestamp: now,
    source: 'simulated',
    isSimulated: true,
  };
  const holding = {
    ...stock,
    quantity: 2,
    costBasis: 300000,
    currentValue: 300000,
    averageBuyPrice: 150000,
    unrealizedPnL: 0,
    returnPercent: 0,
  };
  const p = {
    cash: 99700000,
    totalInvested: 300000,
    holdingsValue: 300000,
    equity: 100000000,
    unrealizedPnL: 0,
    realizedPnL: 0,
    totalPnL: 0,
    returnPercent: 0,
    initialCapital: 100000000,
    holdings: [holding],
    allocation: [
      { name: 'Energy', value: 300000 },
      { name: 'Virtual cash', value: 99700000 },
    ],
    snapshots: [{ createdAt: now, equity: 100000000 }],
    source: 'simulated',
    quoteTimestamps: [now],
    historyNote: 'Observed snapshots only.',
    bestHolding: holding,
    worstHolding: holding,
  };
  const order = {
    _id: '000000000000000000000001',
    symbol: stock.symbol,
    side: 'BUY',
    orderType: 'MARKET',
    quantity: 2,
    status: 'FILLED',
    executionPrice: 150000,
    createdAt: now,
    executedAt: now,
    grossAmount: 300000,
    fees: 0,
    realizedPnL: 0,
  };
  const client = new QueryClient({
    defaultOptions: { queries: { staleTime: Infinity, retry: false } },
  });
  const set = (path, data, params) => client.setQueryData([path, params], data);
  set('/health', { service: 'tradex', database: 'connected' });
  const user = {
    id: '000000000000000000000002',
    fullName: 'Render Test',
    email: 'render@example.test',
    virtualBalance: p.cash,
  };
  Object.assign(useAuth.getInitialState(), { ready: true, user });
  set('/stocks', [stock]);
  set('/stocks/search', [stock]);
  set('/stocks/RELIANCE.NSE', stock);
  set(
    '/stocks/RELIANCE.NSE/history',
    { candles: [{ time: '2026-10-26', open: 149000, high: 151000, low: 148000, close: 150000 }] },
    { range: '1M' },
  );
  set('/portfolio', p);
  set('/portfolio/analytics', p);
  set('/watchlist', { name: 'My watchlist', symbols: [stock.symbol], stocks: [stock] });
  set('/config', { workerEnabled: true });
  set('/alerts', []);
  set('/notifications', []);
  set('/auth/me', user);
  for (const [path, params] of [
    ['/orders', { page: 1, limit: 12, sort: 'desc' }],
    ['/transactions', { page: 1, limit: 12, sort: 'desc' }],
    ['/transactions', { limit: 4 }],
  ])
    set(path, { items: [order], total: 1, page: 1, totalPages: 1 }, params);
  const routes = [
    ['/', 'Your portfolio, in perspective'],
    ['/markets', 'Markets'],
    ['/portfolio', 'Portfolio'],
    ['/analytics', 'Portfolio analytics'],
    ['/trade', 'Put your ideas'],
    ['/watchlist', 'Watchlist'],
    ['/orders', 'Orders'],
    ['/transactions', 'Transactions'],
    ['/settings', 'Settings'],
    ['/alerts', 'Alerts &amp; notifications'],
    ['/stocks/RELIANCE.NSE', 'Reliance Industries'],
    ['/not-a-page', 'Off the chart.'],
  ];
  for (const [path, text] of routes) {
    const html = renderToString(
      <QueryClientProvider client={client}>
        <MemoryRouter initialEntries={[path]}>
          <App />
        </MemoryRouter>
      </QueryClientProvider>,
    );
    assert.ok(
      html.toLowerCase().includes(text.toLowerCase()),
      `Route ${path} did not render expected content`,
    );
  }
  Object.assign(useAuth.getInitialState(), { ready: true, user: null });
  for (const path of ['/login', '/register']) {
    const html = renderToString(
      <QueryClientProvider client={client}>
        <MemoryRouter initialEntries={[path]}>
          <App />
        </MemoryRouter>
      </QueryClientProvider>,
    );
    assert.ok(html.includes('Email address'));
    assert.equal(html.includes('Full name'), path === '/register');
    assert.ok(html.includes(path === '/register' ? 'new-password' : 'current-password'));
  }
  const loginAfterRegistration = renderToString(
    <QueryClientProvider client={client}>
      <MemoryRouter
        initialEntries={[{ pathname: '/login', state: { registeredEmail: 'new@example.test' } }]}
      >
        <App />
      </MemoryRouter>
    </QueryClientProvider>,
  );
  assert.ok(loginAfterRegistration.includes('Account created. Sign in'));
  assert.ok(!loginAfterRegistration.includes('Full name'));
  const credentials = { email: 'new@example.test', password: 'a-secure-password' };
  assert.deepEqual(
    loginSchema.parse({ ...credentials, fullName: '' }),
    credentials,
    'Login must strip stale registration fields so the strict API accepts its payload',
  );
  assert.equal(registrationSchema.safeParse(credentials).success, false);
  assert.equal(registrationSchema.safeParse({ ...credentials, fullName: '' }).success, false);
  client.clear();
  await client.prefetchQuery({
    queryKey: ['/health', undefined],
    queryFn: async () => {
      throw new Error('Offline fixture');
    },
    retry: false,
  });
  const offlineHtml = renderToString(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={['/login']}>
        <App />
      </MemoryRouter>
    </QueryClientProvider>,
  );
  assert.ok(
    offlineHtml.includes('Reconnecting to TradeX'),
    'A missing API must show the reconnect screen',
  );
  assert.ok(
    !offlineHtml.includes('Email address'),
    'Do not expose sign-in forms while the API is unavailable',
  );
  client.clear();
  await checkSessionRefresh(user);
  await checkColdStartRecovery(user);
}
async function checkColdStartRecovery(user) {
  const original = api.defaults.adapter;
  let available = false;
  const requests = [];
  api.defaults.adapter = async (config) => {
    requests.push({ path: config.url, timeout: config.timeout });
    return {
      data: available
        ? { success: true, data: { database: 'connected' } }
        : '<!DOCTYPE html><title>Starting service</title>',
      status: 200,
      statusText: 'OK',
      config,
      headers: {},
    };
  };
  try {
    useAuth.getState().setSession({ user, accessToken: 'preserved-during-wakeup' });
    await assert.rejects(get('/health'), { code: 'API_STARTING' });
    await assert.rejects(restoreSession(), { code: 'API_STARTING' });
    assert.equal(useAuth.getState().token, 'preserved-during-wakeup');
    available = true;
    assert.equal((await get('/health')).database, 'connected');
    assert.equal(requests[0].timeout, 90000, 'Readiness must wait for the free host to wake');
    assert.equal(requests[1].timeout, 15000, 'Session mutations must keep their normal timeout');
    assert.deepEqual(
      [1, 2, 3, 4, 5, 20].map((errorUpdateCount) =>
        connectionPollInterval({ state: { status: 'error', errorUpdateCount } }),
      ),
      [2000, 4000, 8000, 16000, 30000, 30000],
      'Repeated outages must back off instead of hammering the sleeping service',
    );
  } finally {
    api.defaults.adapter = original;
    useAuth.getState().clear();
  }
}
async function checkSessionRefresh(user) {
  const original = api.defaults.adapter;
  let refreshCount = 0;
  api.defaults.adapter = async (config) => {
    const response = (data) => ({
      data: { success: true, data },
      status: 200,
      statusText: 'OK',
      config,
      headers: {},
    });
    if (config.url === '/auth/refresh') {
      refreshCount++;
      await new Promise((resolve) => setTimeout(resolve, 5));
      return response({ accessToken: 'rotated-test-token', user });
    }
    if (
      config.url === '/auth/login' ||
      config.headers.Authorization === 'Bearer expired-test-token'
    ) {
      const error = new Error('Expired fixture token');
      error.config = config;
      error.response = { status: 401 };
      throw error;
    }
    return response(user);
  };
  try {
    useAuth.getState().setSession({ user, accessToken: 'expired-test-token' });
    await Promise.all([api.get('/auth/me'), api.get('/portfolio')]);
    assert.equal(refreshCount, 1, 'Concurrent unauthorized requests must share one refresh');
    assert.equal(useAuth.getState().token, 'rotated-test-token');
    await assert.rejects(api.post('/auth/login'), /Expired fixture token/);
    assert.equal(refreshCount, 1, 'Invalid login must not start a refresh loop');
    const pending = restoreSession();
    useAuth.getState().clear();
    await assert.rejects(pending, /session changed/);
    assert.equal(
      useAuth.getState().user,
      null,
      'A late refresh must not restore a signed-out session',
    );
  } finally {
    api.defaults.adapter = original;
  }
  useAuth.getState().setSession({ user, accessToken: 'still-valid-test-token' });
  api.defaults.adapter = async () => {
    throw new Error('Network unavailable');
  };
  try {
    await assert.rejects(restoreSession(), /Network unavailable/);
    assert.equal(
      useAuth.getState().token,
      'still-valid-test-token',
      'A network outage must not clear an authenticated session',
    );
  } finally {
    api.defaults.adapter = original;
    useAuth.getState().clear();
  }
}
