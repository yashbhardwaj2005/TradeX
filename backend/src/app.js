import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import rateLimit from 'express-rate-limit';
import mongoose from 'mongoose';
import { env, origins } from './config/env.js';
import { authRouter } from './routes/auth.routes.js';
import { stocksRouter } from './routes/stocks.routes.js';
import { tradingRouter } from './routes/trading.routes.js';
import { portfolioRouter } from './routes/portfolio.routes.js';
import { accountRouter } from './routes/account.routes.js';
import { alertsRouter } from './routes/alerts.routes.js';
import { originGuard, errorHandler } from './middlewares/security.js';
import { AppError } from './utils/errors.js';
import { attachFrontend } from './middlewares/frontend.js';
import { fileURLToPath } from 'node:url';
export const app = express();
app.disable('x-powered-by');
app.set('trust proxy', env.TRUST_PROXY);
app.use(
  helmet(),
  cors({
    origin: origins,
    credentials: true,
    allowedHeaders: ['Content-Type', 'Authorization', 'Idempotency-Key'],
  }),
  originGuard,
  express.json({ limit: '32kb' }),
  cookieParser(),
);
app.use(
  '/api',
  rateLimit({
    windowMs: 60000,
    limit: 240,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    message: {
      success: false,
      error: { code: 'RATE_LIMITED', message: 'Too many requests. Please wait a moment.' },
    },
  }),
);
app.get('/api/health', (req, res) =>
  res.status(mongoose.connection.readyState === 1 ? 200 : 503).json({
    success: mongoose.connection.readyState === 1,
    service: 'tradex',
    database: mongoose.connection.readyState === 1 ? 'connected' : 'unavailable',
    marketProvider: env.MARKET_PROVIDER,
    workerEnabled: env.WORKER_ENABLED,
  }),
);
app.use('/api/v1/auth', authRouter);
app.get('/api/v1/health', (req, res) =>
  res.status(mongoose.connection.readyState === 1 ? 200 : 503).json({
    success: mongoose.connection.readyState === 1,
    data: {
      service: 'tradex',
      database: mongoose.connection.readyState === 1 ? 'connected' : 'unavailable',
    },
  }),
);
app.get('/api/v1/config', (req, res) =>
  res.json({
    success: true,
    data: {
      paperTrading: true,
      marketProvider: env.MARKET_PROVIDER,
      workerEnabled: env.WORKER_ENABLED,
    },
  }),
);
app.use('/api/v1/stocks', stocksRouter);
app.use('/api/v1', tradingRouter);
app.use('/api/v1/portfolio', portfolioRouter);
app.use('/api/v1', accountRouter);
app.use('/api/v1', alertsRouter);
export function finishRoutes() {
  if (env.SERVE_FRONTEND)
    attachFrontend(app, fileURLToPath(new URL('../../frontend/dist/', import.meta.url)));
  app.use((req, res, next) => next(new AppError(404, 'NOT_FOUND', 'Endpoint not found.')));
  app.use(errorHandler);
}
