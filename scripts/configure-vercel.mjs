import { readFile, writeFile } from 'node:fs/promises';
const input = process.argv[2];
if (!input)
  throw new Error('Usage: node scripts/configure-vercel.mjs https://your-render-api.onrender.com');
const api = new URL(input);
if (
  api.protocol !== 'https:' ||
  api.username ||
  api.password ||
  api.search ||
  api.hash ||
  api.pathname !== '/'
)
  throw new Error(
    'Provide the public HTTPS backend origin only, without credentials or an API path.',
  );
const file = new URL('../frontend/vercel.json', import.meta.url);
const config = JSON.parse(await readFile(file, 'utf8'));
config.rewrites = [
  { source: '/api/:path*', destination: `${api.origin}/api/:path*` },
  { source: '/((?!assets/).*)', destination: '/index.html' },
];
await writeFile(file, `${JSON.stringify(config, null, 2)}\n`);
console.log(
  `Vercel will proxy /api to ${api.origin}. Leave VITE_API_URL unset and configure Render CLIENT_ORIGINS with the Vercel frontend origin.`,
);
