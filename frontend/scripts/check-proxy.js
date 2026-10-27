import assert from 'node:assert/strict';
import { createServer as createHttpServer } from 'node:http';
import { createServer as createViteServer } from 'vite';
const target = createHttpServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ success: true, data: { database: 'connected' } }));
});
const listen = (server, port) =>
  new Promise((resolve) => server.listen(port, '127.0.0.1', resolve));
const close = (server) =>
  new Promise((resolve) => {
    server.closeAllConnections?.();
    server.close(resolve);
  });
await listen(target, 0);
const targetPort = target.address().port;
await close(target);
const previousTarget = process.env.TRADEX_API_TARGET;
process.env.TRADEX_API_TARGET = `http://127.0.0.1:${targetPort}`;
let vite;
try {
  vite = await createViteServer({
    server: { host: '127.0.0.1', port: 0, strictPort: false, hmr: false },
    optimizeDeps: { noDiscovery: true, include: [] },
    logLevel: 'silent',
  });
  await vite.listen();
  const origin = `http://127.0.0.1:${vite.httpServer.address().port}`;
  const unavailable = await fetch(`${origin}/api/v1/health`);
  assert.equal(unavailable.status, 503);
  assert.equal((await unavailable.json()).error.code, 'API_STARTING');
  await listen(target, targetPort);
  const recovered = await fetch(`${origin}/api/v1/health`);
  assert.equal(recovered.status, 200);
  assert.equal((await recovered.json()).data.database, 'connected');
  console.log(
    'PASS: an unavailable API returns a structured 503 and the same frontend proxy recovers when the API starts.',
  );
} finally {
  await vite?.close();
  if (target.listening) await close(target);
  if (previousTarget === undefined) delete process.env.TRADEX_API_TARGET;
  else process.env.TRADEX_API_TARGET = previousTarget;
}
