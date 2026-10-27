import { inTransaction } from '../utils/transaction.js';

import { createHash } from 'node:crypto';
import { z } from 'zod';
import { User, Holding, Order, Transaction } from '../models/index.js';
import { orderSchema } from '../validators/index.js';
import { executableQuote, validateExecutableQuote } from './market.service.js';
import { env } from '../config/env.js';
import { AppError, requireValue } from '../utils/errors.js';
import { allocatedCost, safeMoney } from '../utils/money.js';
const keySchema = z
  .string()
  .min(8)
  .max(128)
  .regex(/^[A-Za-z0-9_-]+$/);
const hashRequest = (input) => createHash('sha256').update(JSON.stringify(input)).digest('hex');
function checkReplay(order, hash) {
  requireValue(
    order.requestHash === hash,
    409,
    'IDEMPOTENCY_CONFLICT',
    'This idempotency key was already used for a different order.',
  );
  return order;
}
async function lockAccount(userId, session) {
  // Every account mutation writes this document first. MongoDB retries conflicting
  // transactions against a fresh snapshot, serializing concurrent trade decisions.
  return requireValue(
    await User.findOneAndUpdate(
      { _id: userId },
      { $inc: { accountVersion: 1 } },
      { new: true, session },
    ),
    401,
    'UNAUTHORIZED',
    'Account not found.',
  );
}
async function checkResources(user, input, price, session) {
  const gross = safeMoney(price * input.quantity);
  if (input.side === 'BUY')
    requireValue(
      user.virtualBalance >= gross,
      422,
      'INSUFFICIENT_FUNDS',
      'You do not have enough virtual funds for this order.',
    );
  else {
    const holding = await Holding.findOne({ userId: user._id, symbol: input.symbol }).session(
      session,
    );
    requireValue(
      holding && holding.quantity >= input.quantity,
      422,
      'INSUFFICIENT_SHARES',
      'You cannot sell more shares than you own.',
    );
  }
}
async function fill(user, order, quote, session) {
  validateExecutableQuote(quote);
  await checkResources(user, order, quote.price, session);
  const gross = safeMoney(quote.price * order.quantity);
  const existing = await Holding.findOne({ userId: user._id, symbol: order.symbol }).session(
    session,
  );
  let costBasis = gross,
    realizedPnL = 0;
  if (order.side === 'BUY') {
    const debited = await User.updateOne(
      { _id: user._id, virtualBalance: { $gte: gross } },
      { $inc: { virtualBalance: -gross } },
      { session },
    );
    requireValue(debited.modifiedCount, 422, 'INSUFFICIENT_FUNDS', 'Insufficient virtual funds.');
    safeMoney((existing?.costBasis || 0) + gross);
    safeMoney((existing?.quantity || 0) + order.quantity);
    await Holding.updateOne(
      { userId: user._id, symbol: order.symbol },
      { $inc: { quantity: order.quantity, costBasis: gross } },
      { upsert: true, session },
    );
  } else {
    costBasis = allocatedCost(existing.costBasis, order.quantity, existing.quantity);
    realizedPnL = gross - costBasis;
    const reduced = await Holding.updateOne(
      { _id: existing._id, quantity: { $gte: order.quantity } },
      { $inc: { quantity: -order.quantity, costBasis: -costBasis } },
      { session },
    );
    requireValue(reduced.modifiedCount, 422, 'INSUFFICIENT_SHARES', 'Insufficient shares.');
    await Holding.deleteOne({ _id: existing._id, quantity: 0 }, { session });
    const credited = await User.updateOne(
      { _id: user._id, virtualBalance: { $lte: Number.MAX_SAFE_INTEGER - gross } },
      { $inc: { virtualBalance: gross } },
      { session },
    );
    requireValue(
      credited.modifiedCount,
      422,
      'AMOUNT_OUT_OF_RANGE',
      'Account balance exceeds the supported range.',
    );
  }
  const executedAt = new Date();
  await Transaction.create(
    [
      {
        userId: user._id,
        orderId: order._id,
        symbol: order.symbol,
        side: order.side,
        quantity: order.quantity,
        executionPrice: quote.price,
        grossAmount: gross,
        fees: 0,
        costBasis,
        realizedPnL,
        executedAt,
        quoteSource: quote.source,
      },
    ],
    { session },
  );
  return Order.findOneAndUpdate(
    { _id: order._id, status: 'PENDING' },
    {
      $set: {
        status: 'FILLED',
        executionPrice: quote.price,
        executedAt,
        quoteSource: quote.source,
        quoteTimestamp: quote.timestamp,
      },
    },
    { new: true, session },
  );
}
export async function submitOrder(userId, rawInput, rawKey) {
  const input = orderSchema.parse(rawInput),
    idempotencyKey = keySchema.parse(rawKey),
    requestHash = hashRequest(input);
  const prior = await Order.findOne({ userId, idempotencyKey });
  if (prior) return checkReplay(prior, requestHash);
  requireValue(
    input.orderType !== 'LIMIT' || env.WORKER_ENABLED,
    503,
    'WORKER_DISABLED',
    'Automatic limit orders are disabled because the background worker is not configured.',
  );
  const quote = await executableQuote(input.symbol);
  try {
    return await inTransaction(async (session) => {
      const user = await lockAccount(userId, session);
      const duplicate = await Order.findOne({ userId, idempotencyKey }).session(session);
      if (duplicate) return checkReplay(duplicate, requestHash);
      await checkResources(
        user,
        input,
        input.orderType === 'LIMIT' ? input.limitPrice : quote.price,
        session,
      );
      const [order] = await Order.create([{ ...input, userId, idempotencyKey, requestHash }], {
        session,
      });
      if (input.orderType === 'LIMIT') return order;
      return fill(user, order, quote, session);
    });
  } catch (error) {
    if (error.code === 11000) {
      const duplicate = await Order.findOne({ userId, idempotencyKey });
      if (duplicate) return checkReplay(duplicate, requestHash);
    }
    throw error;
  }
}
export async function cancelOrder(userId, orderId) {
  return inTransaction(async (session) => {
    await lockAccount(userId, session);
    const order = await Order.findOneAndUpdate(
      { _id: orderId, userId, status: 'PENDING' },
      { $set: { status: 'CANCELLED' } },
      { new: true, session },
    );
    requireValue(
      order,
      409,
      'ORDER_NOT_CANCELLABLE',
      'This order is not pending or does not belong to you.',
    );
    return order;
  });
}
export async function evaluatePendingOrder(orderId) {
  const pending = await Order.findOne({ _id: orderId, status: 'PENDING', orderType: 'LIMIT' });
  if (!pending) return null;
  const quote = await executableQuote(pending.symbol);
  if (pending.side === 'BUY' ? quote.price > pending.limitPrice : quote.price < pending.limitPrice)
    return null;
  return inTransaction(async (session) => {
    const user = await lockAccount(pending.userId, session);
    const order = await Order.findOne({ _id: orderId, status: 'PENDING' }).session(session);
    if (!order) return null;
    try {
      await checkResources(user, order, quote.price, session);
    } catch (error) {
      if (error instanceof AppError && error.status === 422) {
        order.status = 'REJECTED';
        order.rejectionReason = error.message;
        await order.save({ session });
        return order;
      }
      throw error;
    }
    return fill(user, order, quote, session);
  });
}
