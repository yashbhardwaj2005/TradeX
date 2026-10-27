import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const backendDirectory = path.join(root, 'backend');
const envPath = path.join(backendDirectory, '.env');
if (existsSync(envPath)) process.loadEnvFile(envPath);
const forceLocal = process.argv.includes('--local');
const external = !forceLocal && (process.argv.includes('--external') || !!process.env.MONGODB_URI);
const apiPort = Number(process.env.PORT || 4000),
  webPort = Number(process.env.VITE_PORT || 5173);
if (![apiPort, webPort].every((port) => Number.isInteger(port) && port > 0 && port <= 65535))
  throw new Error('PORT and VITE_PORT must be valid port numbers.');
const apiOrigin = `http://127.0.0.1:${apiPort}`,
  webOrigin = `http://127.0.0.1:${webPort}`;
const children = new Set();
let stopping = false;
async function readResponse(url) {
  try {
    return await fetch(url, { signal: AbortSignal.timeout(1500) });
  } catch {
    return null;
  }
}
async function apiReady(origin) {
  const response = await readResponse(`${origin}/api/health`);
  if (!response?.ok) return false;
  const health = await response.json().catch(() => null);
  return ['tradex', 'tradeforge'].includes(health?.service) && health.database === 'connected';
}
function launch(name, args, cwd, extraEnv = {}) {
  const child = spawn(process.execPath, args, {
    cwd,
    stdio: 'inherit',
    windowsHide: true,
    env: { ...process.env, ...extraEnv },
  });
  children.add(child);
  child.on('error', (error) => {
    console.error(`${name} could not start: ${error.message}`);
    stop(1);
  });
  child.on('exit', (code) => {
    children.delete(child);
    if (!stopping) {
      console.error(`${name} stopped (exit ${code ?? 'signal'}).`);
      stop(code || 1);
    }
  });
  return child;
}
function stop(code = 0) {
  if (stopping) return;
  stopping = true;
  for (const child of children) child.kill();
  process.exitCode = code;
}
process.on('SIGINT', () => stop());
process.on('SIGTERM', () => stop());
async function main() {
  console.log(`Starting TradeX · ${external ? 'configured MongoDB' : 'persistent local MongoDB'}…`);
  if (await apiReady(apiOrigin)) console.log(`Using the healthy API at ${apiOrigin}.`);
  else {
    const occupied = await readResponse(`${apiOrigin}/api/health`);
    if (occupied)
      throw new Error(
        `Port ${apiPort} is occupied by an unhealthy or different API. Stop that instance before starting TradeX.`,
      );
    launch('API', external ? ['--watch', 'src/index.js'] : ['scripts/local.js'], backendDirectory);
    console.log('Waiting for MongoDB and the API before opening the frontend…');
    const deadline = Date.now() + 300000;
    while (!stopping && !(await apiReady(apiOrigin))) {
      if (Date.now() >= deadline)
        throw new Error(
          'API startup timed out. Read the database/startup error above; the frontend has not been started.',
        );
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
    if (stopping) return;
  }
  const existingFrontend = await readResponse(webOrigin);
  if (existingFrontend) {
    if (!(await existingFrontend.text()).includes('TradeX'))
      throw new Error(`Port ${webPort} belongs to another app. Choose a different VITE_PORT.`);
    console.log(`Using your existing TradeX frontend at ${webOrigin}.`);
  } else {
    launch(
      'Frontend',
      [
        path.join(root, 'node_modules/vite/bin/vite.js'),
        '--host',
        '127.0.0.1',
        '--port',
        String(webPort),
        '--strictPort',
      ],
      path.join(root, 'frontend'),
      { TRADEX_API_TARGET: apiOrigin },
    );
  }
  const frontendDeadline = Date.now() + 30000;
  while (!stopping) {
    const response = await readResponse(`${webOrigin}/api/v1/health`);
    const health = response?.ok ? await response.json().catch(() => null) : null;
    if (health?.data?.database === 'connected') break;
    if (Date.now() >= frontendDeadline)
      throw new Error(
        'The frontend cannot reach the API. Restart any old frontend process and run npm run dev again.',
      );
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  if (!stopping) console.log(`TradeX API is ready. Open ${webOrigin}/`);
}
main().catch((error) => {
  console.error(`TradeX startup failed: ${error.message}`);
  stop(1);
});
