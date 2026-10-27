import { Order, PriceAlert, User } from '../models/index.js';
import { evaluatePendingOrder } from '../services/trading.service.js';
import { evaluateAlert } from '../services/alerts.service.js';
import { recordSnapshot } from '../services/portfolio.service.js';
import { env } from '../config/env.js';
async function safely(task, context) {
  try {
    await task();
  } catch (error) {
    console.error(
      JSON.stringify({
        level: 'warn',
        job: context,
        code: error.code || 'JOB_ERROR',
        message: error.message,
      }),
    );
  }
}
export async function runWorkerCycle() {
  // Durable pending state is in MongoDB. Transactions make overlapping API
  // instances safe; a process restart resumes the next polling cycle.
  for await (const order of Order.find({ status: 'PENDING', orderType: 'LIMIT' })
    .select('_id')
    .sort({ _id: 1 })
    .cursor())
    await safely(() => evaluatePendingOrder(order._id), `order:${order._id}`);
  for await (const alert of PriceAlert.find({ isActive: true })
    .select('_id')
    .sort({ _id: 1 })
    .cursor())
    await safely(() => evaluateAlert(alert._id), `alert:${alert._id}`);
}
export function startWorker() {
  if (!env.WORKER_ENABLED) {
    console.log('Background worker disabled; limit orders and alerts are unavailable.');
    return async () => {};
  }
  let stopped = false,
    running = null,
    lastBucket = null;
  async function tick() {
    if (stopped || running) return;
    running = (async () => {
      await safely(runWorkerCycle, 'market-cycle');
      const bucket = Math.floor(Date.now() / (15 * 60000));
      if (bucket !== lastBucket) {
        for await (const user of User.find().select('_id').cursor())
          await safely(() => recordSnapshot(String(user._id)), `snapshot:${user._id}`);
        lastBucket = bucket;
      }
    })();
    try {
      await running;
    } catch (error) {
      console.error(JSON.stringify({ level: 'error', job: 'worker', message: error.message }));
    } finally {
      running = null;
    }
  }
  const timer = setInterval(tick, env.WORKER_INTERVAL_MS);
  timer.unref();
  tick();
  return async () => {
    stopped = true;
    clearInterval(timer);
    if (running) await running;
  };
}
