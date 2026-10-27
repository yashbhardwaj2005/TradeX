import { AppError, requireValue } from '../utils/errors.js';
import { env } from '../config/env.js';
export const catalogue = [
  ['RELIANCE', 'Reliance Industries', 'Energy', 147850, '#9d92ef'],
  ['TCS', 'Tata Consultancy Services', 'Technology', 351220, '#6b9de9'],
  ['HDFCBANK', 'HDFC Bank', 'Financials', 173540, '#619acb'],
  ['INFY', 'Infosys', 'Technology', 182630, '#73b3ba'],
  ['ICICIBANK', 'ICICI Bank', 'Financials', 126870, '#da9a6c'],
  ['BHARTIARTL', 'Bharti Airtel', 'Telecom', 165480, '#df7c95'],
  ['ITC', 'ITC Limited', 'Consumer goods', 42680, '#8abf9b'],
  ['LT', 'Larsen & Toubro', 'Industrials', 348950, '#b4aa77'],
  ['WIPRO', 'Wipro', 'Technology', 28940, '#a599c5'],
  ['TATAMOTORS', 'Tata Motors', 'Automotive', 74560, '#7f9ca6'],
  ['SUNPHARMA', 'Sun Pharmaceutical', 'Healthcare', 176890, '#c893bb'],
  ['MARUTI', 'Maruti Suzuki', 'Automotive', 1214850, '#7c91d5'],
  ['AXISBANK', 'Axis Bank', 'Financials', 111720, '#ba8eaa'],
  ['ASIANPAINT', 'Asian Paints', 'Consumer goods', 234870, '#c5a881'],
  ['TITAN', 'Titan Company', 'Consumer goods', 328540, '#80b7a8'],
  ['BAJFINANCE', 'Bajaj Finance', 'Financials', 89470, '#939cce'],
].map(([ticker, name, sector, basePrice, color], index) => ({
  symbol: `${ticker}.NSE`,
  ticker,
  name,
  sector,
  basePrice,
  color,
  index,
}));
function stockFor(symbol) {
  return requireValue(
    catalogue.find((s) => s.symbol === symbol),
    404,
    'SYMBOL_NOT_FOUND',
    'This stock is not available from the configured provider.',
  );
}
// A deterministic synthetic path, not exchange prices or a replay of actual markets.
function simulatedPrice(stock, timestamp) {
  const day = (timestamp - Date.UTC(2025, 0, 1)) / 86400000;
  const wave =
    0.022 * Math.sin(day / 12 + stock.index) +
    0.012 * Math.sin(day / 2.7 + stock.index * 3) +
    0.005 * Math.sin(day * 4 + stock.index);
  return Math.max(1, Math.round(stock.basePrice * (1 + wave + 0.00012 * (day % 365))));
}
export class SimulatedProvider {
  name = 'simulated';
  async search(query = '') {
    const q = query.toLowerCase();
    return catalogue
      .filter((s) => `${s.ticker} ${s.name} ${s.sector}`.toLowerCase().includes(q))
      .map(({ basePrice, index, ...s }) => s);
  }
  async quote(symbol) {
    const stock = stockFor(symbol);
    const now = Math.floor(Date.now() / 15000) * 15000;
    const price = simulatedPrice(stock, now);
    const previousClose = simulatedPrice(stock, now - 86400000);
    const { basePrice, index, ...details } = stock;
    return {
      ...details,
      price,
      previousClose,
      change: price - previousClose,
      changePercent: ((price - previousClose) / previousClose) * 100,
      high: Math.max(price, previousClose) + Math.round(price * 0.003),
      low: Math.min(price, previousClose) - Math.round(price * 0.003),
      open: previousClose,
      volume: 1200000 + stock.index * 177731,
      source: 'simulated',
      isSimulated: true,
      timestamp: new Date(now).toISOString(),
      marketStatus: 'SIMULATION',
      currency: 'INR',
    };
  }
  async history(symbol, range = '1M') {
    const stock = stockFor(symbol);
    const now = Date.now();
    const days = { '1W': 7, '1M': 30, '3M': 90, '6M': 180, '1Y': 365 }[range] || 30;
    const candles = [];
    for (let i = days; i >= 0; i--) {
      const timestamp = now - i * 86400000;
      const date = new Date(timestamp);
      if ([0, 6].includes(date.getUTCDay())) continue;
      const open = simulatedPrice(stock, timestamp - 86400000),
        close = simulatedPrice(stock, timestamp);
      candles.push({
        time: date.toISOString().slice(0, 10),
        open,
        high: Math.max(open, close) + Math.round(close * 0.007),
        low: Math.min(open, close) - Math.round(close * 0.006),
        close,
        volume: 1000000 + i * 2033,
      });
    }
    return { symbol, range, source: 'simulated', isSimulated: true, candles };
  }
}
let provider = new SimulatedProvider();
const cache = new Map();
export function setMarketProvider(next) {
  provider = next;
  cache.clear();
}
export const searchStocks = (query) => provider.search(query);
export async function getQuote(symbol) {
  const key = `${symbol}`;
  const cached = cache.get(key);
  if (cached && Date.now() - cached.cachedAt < 5000) return cached.value;
  try {
    const value = await provider.quote(symbol);
    cache.set(key, { value, cachedAt: Date.now() });
    return value;
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError(
      503,
      'MARKET_DATA_UNAVAILABLE',
      'Market data is unavailable. Please try again later.',
    );
  }
}
export function validateExecutableQuote(quote) {
  const age = Date.now() - new Date(quote.timestamp).getTime();
  requireValue(
    Number.isSafeInteger(quote.price) && quote.price > 0 && quote.price <= 1000000000,
    503,
    'INVALID_QUOTE',
    'The provider returned an invalid price.',
  );
  requireValue(
    Number.isFinite(age) && age >= -5000 && age <= env.MAX_QUOTE_AGE_MS,
    503,
    'STALE_QUOTE',
    'The available quote is too old to execute this trade.',
  );
  return quote;
}
export async function executableQuote(symbol) {
  return validateExecutableQuote(await getQuote(symbol));
}
export const getHistory = (symbol, range) => provider.history(symbol, range);
export async function listStocks(query = '') {
  return Promise.all((await searchStocks(query)).map((s) => getQuote(s.symbol)));
}
