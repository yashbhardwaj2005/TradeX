import { inTransaction } from '../utils/transaction.js';
import mongoose from 'mongoose';
import { User, Holding, Transaction, Snapshot } from '../models/index.js';
import { getQuote } from './market.service.js';
import { env } from '../config/env.js';
import { requireValue } from '../utils/errors.js';
export const INITIAL_CAPITAL = 100000000;
export async function getPortfolio(userId) {
  const account = await inTransaction(async (session) => {
    const user = requireValue(
      await User.findById(userId).session(session),
      401,
      'UNAUTHORIZED',
      'Account not found.',
    );
    const holdings = await Holding.find({ userId }).session(session).lean();
    const realized = await Transaction.aggregate([
      { $match: { userId: new mongoose.Types.ObjectId(userId) } },
      { $group: { _id: null, total: { $sum: '$realizedPnL' } } },
    ]).session(session);
    return { cash: user.virtualBalance, holdings, realizedPnL: realized[0]?.total || 0 };
  });
  const holdings = await Promise.all(
    account.holdings.map(async (h) => {
      const quote = await getQuote(h.symbol);
      const currentValue = h.quantity * quote.price;
      return {
        ...h,
        name: quote.name,
        ticker: quote.ticker || h.symbol.replace('.NSE', ''),
        sector: quote.sector,
        color: quote.color,
        averageBuyPrice: h.costBasis / h.quantity,
        price: quote.price,
        currentValue,
        unrealizedPnL: currentValue - h.costBasis,
        returnPercent: h.costBasis ? ((currentValue - h.costBasis) / h.costBasis) * 100 : 0,
        changePercent: quote.changePercent,
        quoteTimestamp: quote.timestamp,
        quoteSource: quote.source,
        isStale: Date.now() - Date.parse(quote.timestamp) > env.MAX_QUOTE_AGE_MS,
      };
    }),
  );
  const totalInvested = holdings.reduce((n, h) => n + h.costBasis, 0),
    holdingsValue = holdings.reduce((n, h) => n + h.currentValue, 0),
    equity = account.cash + holdingsValue;
  const sectors = new Map();
  for (const h of holdings) {
    const sector = h.sector || 'Other';
    sectors.set(sector, (sectors.get(sector) || 0) + h.currentValue);
  }
  const allocation = [...sectors].map(([name, value]) => ({ name, value }));
  if (account.cash) allocation.push({ name: 'Virtual cash', value: account.cash });
  return {
    cash: account.cash,
    totalInvested,
    holdingsValue,
    equity,
    unrealizedPnL: holdingsValue - totalInvested,
    realizedPnL: account.realizedPnL,
    totalPnL: equity - INITIAL_CAPITAL,
    returnPercent: ((equity - INITIAL_CAPITAL) / INITIAL_CAPITAL) * 100,
    initialCapital: INITIAL_CAPITAL,
    holdings,
    allocation,
    source: env.MARKET_PROVIDER,
    hasStaleQuotes: holdings.some((h) => h.isStale),
    valuationAt: new Date().toISOString(),
    quoteTimestamps: holdings.map((h) => h.quoteTimestamp),
    returnDefinition:
      '(current equity − initial virtual capital) / initial virtual capital; no deposits or withdrawals',
  };
}
export async function getAnalytics(userId) {
  const portfolio = await getPortfolio(userId);
  const snapshots = await Snapshot.find({ userId }).sort({ createdAt: -1 }).limit(300).lean();
  snapshots.reverse();
  const ranked = [...portfolio.holdings].sort((a, b) => b.returnPercent - a.returnPercent);
  return {
    ...portfolio,
    snapshots,
    bestHolding: ranked[0] || null,
    worstHolding: ranked.at(-1) || null,
    historyNote:
      'Observed account snapshots only. Prices are simulated. History begins at registration; it is never backfilled from current holdings.',
  };
}
export async function recordSnapshot(userId) {
  const p = await getPortfolio(userId),
    bucket = String(Math.floor(Date.now() / (15 * 60000)));
  return Snapshot.updateOne(
    { userId, bucket },
    {
      $setOnInsert: {
        cash: p.cash,
        holdingsValue: p.holdingsValue,
        equity: p.equity,
        source: p.source,
        quoteTimestamp: p.valuationAt,
      },
    },
    { upsert: true },
  );
}
