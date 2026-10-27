import { Watchlist } from '../models/index.js';
import { getQuote } from './market.service.js';
import { requireValue } from '../utils/errors.js';
export async function getWatchlist(userId) {
  const list = await Watchlist.findOne({ userId });
  const stocks = await Promise.all((list?.symbols || []).map(getQuote));
  return {
    id: list?._id,
    name: list?.name || 'My watchlist',
    symbols: list?.symbols || [],
    stocks,
  };
}
export async function addToWatchlist(userId, symbol) {
  await getQuote(symbol);
  const list = await Watchlist.findOneAndUpdate(
    { userId, $or: [{ symbols: symbol }, { $expr: { $lt: [{ $size: '$symbols' }, 50] } }] },
    { $addToSet: { symbols: symbol } },
    { new: true },
  );
  requireValue(list, 422, 'WATCHLIST_FULL', 'Your watchlist can contain up to 50 stocks.');
  return getWatchlist(userId);
}
export async function removeFromWatchlist(userId, symbol) {
  await Watchlist.updateOne({ userId }, { $pull: { symbols: symbol } });
  return getWatchlist(userId);
}
