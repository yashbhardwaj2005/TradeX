import { inTransaction } from '../utils/transaction.js';

import { PriceAlert, Notification } from '../models/index.js';
import { alertSchema } from '../validators/index.js';
import { env } from '../config/env.js';
import { executableQuote } from './market.service.js';
import { requireValue } from '../utils/errors.js';
export const listAlerts = (userId) =>
  PriceAlert.find({ userId }).sort({ createdAt: -1 }).limit(200).lean();
export async function createAlert(userId, rawInput) {
  requireValue(
    env.WORKER_ENABLED,
    503,
    'WORKER_DISABLED',
    'Price alerts are disabled because the background worker is not configured.',
  );
  const input = alertSchema.parse(rawInput);
  await executableQuote(input.symbol);
  requireValue(
    (await PriceAlert.countDocuments({ userId, isActive: true })) < 100,
    422,
    'ALERT_LIMIT',
    'You may have up to 100 active price alerts.',
  );
  return PriceAlert.create({ ...input, userId });
}
export async function deleteAlert(userId, id) {
  requireValue(
    await PriceAlert.findOneAndDelete({ _id: id, userId }),
    404,
    'ALERT_NOT_FOUND',
    'Alert not found.',
  );
  return { message: 'Alert removed.' };
}
export async function evaluateAlert(alertId) {
  const alert = await PriceAlert.findOne({ _id: alertId, isActive: true });
  if (!alert) return null;
  const quote = await executableQuote(alert.symbol);
  if (alert.condition === 'GTE' ? quote.price < alert.targetPrice : quote.price > alert.targetPrice)
    return null;
  return inTransaction(async (session) => {
    const triggered = await PriceAlert.findOneAndUpdate(
      { _id: alertId, isActive: true },
      { $set: { isActive: false, triggeredAt: new Date() } },
      { new: true, session },
    );
    if (!triggered) return null;
    const price = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(
      quote.price / 100,
    );
    const [notification] = await Notification.create(
      [
        {
          userId: alert.userId,
          alertId: alert._id,
          title: `${alert.symbol.replace('.NSE', '')} price alert`,
          message: `Simulated price reached ${price}. Your ${alert.condition === 'GTE' ? 'at or above' : 'at or below'} target was met. Quote: ${quote.timestamp}.`,
        },
      ],
      { session },
    );
    return notification;
  });
}
export const listNotifications = (userId) =>
  Notification.find({ userId }).sort({ createdAt: -1 }).limit(100).lean();
export async function markRead(userId, id) {
  return requireValue(
    await Notification.findOneAndUpdate(
      { _id: id, userId },
      { $set: { readAt: new Date() } },
      { new: true },
    ),
    404,
    'NOTIFICATION_NOT_FOUND',
    'Notification not found.',
  );
}
