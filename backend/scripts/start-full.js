import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
const envPath = fileURLToPath(new URL('../.env', import.meta.url));
if (existsSync(envPath)) process.loadEnvFile(envPath);
process.env.SERVE_FRONTEND = 'true';
await import('../src/index.js');
