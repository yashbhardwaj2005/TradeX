import mongoose from 'mongoose';
import { env } from './config/env.js';
import { connectDatabase } from './config/database.js';
import { initializeModels } from './models/index.js';
import { app, finishRoutes } from './app.js';
import { startWorker } from './jobs/market.worker.js';
await connectDatabase(env.MONGODB_URI);
await initializeModels();
finishRoutes();
const stopWorker = startWorker();
const server = app.listen(env.PORT, '0.0.0.0', () =>
  console.log(`TradeX API http://127.0.0.1:${env.PORT} · ${env.MARKET_PROVIDER} prices`),
);
async function shutdown() {
  server.close(async () => {
    await stopWorker();
    await mongoose.disconnect();
    process.exit(0);
  });
}
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
