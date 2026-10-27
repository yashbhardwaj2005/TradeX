import 'dotenv/config';
import { z } from 'zod';
const bool = z.enum(['true', 'false']).transform((v) => v === 'true');
const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().min(1).default(4000),
  MONGODB_URI: z.string().min(1),
  CLIENT_ORIGINS: z.string().default('http://127.0.0.1:5173,http://localhost:5173'),
  JWT_ACCESS_SECRET: z.string().min(32),
  JWT_REFRESH_SECRET: z.string().min(32),
  COOKIE_SECURE: bool.default(false),
  COOKIE_SAME_SITE: z.enum(['lax', 'strict', 'none']).default('lax'),
  MARKET_PROVIDER: z.literal('simulated').default('simulated'),
  MAX_QUOTE_AGE_MS: z.coerce.number().int().positive().default(120000),
  WORKER_ENABLED: bool.default(true),
  SERVE_FRONTEND: bool.default(false),
  PUBLIC_APP_URL: z.url().optional(),
  WORKER_INTERVAL_MS: z.coerce.number().int().min(1000).default(15000),
  TRUST_PROXY: z.coerce.number().int().min(0).default(0),
});
export const env = schema.parse(process.env);
if (env.COOKIE_SAME_SITE === 'none' && !env.COOKIE_SECURE)
  throw new Error('SameSite=None requires secure cookies.');
if (
  env.NODE_ENV === 'production' &&
  (!env.COOKIE_SECURE ||
    env.JWT_ACCESS_SECRET.includes('replace-with') ||
    env.JWT_REFRESH_SECRET.includes('replace-with'))
)
  throw new Error('Production requires secure cookies and strong unique secrets.');
const hostedOrigin = env.PUBLIC_APP_URL || process.env.RENDER_EXTERNAL_URL;
export const origins = [
  ...new Set([
    ...env.CLIENT_ORIGINS.split(',')
      .map((v) => v.trim())
      .filter(Boolean),
    ...(hostedOrigin ? [new URL(hostedOrigin).origin] : []),
  ]),
];
