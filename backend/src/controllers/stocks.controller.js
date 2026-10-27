import { z } from 'zod';
import { symbolSchema } from '../validators/index.js';
import * as market from '../services/market.service.js';
import { ok } from '../utils/errors.js';
const searchSchema = z.string().max(80).default('');
export const list = async (req, res) =>
  ok(res, await market.listStocks(searchSchema.parse(req.query.q)));
export const search = async (req, res) =>
  ok(res, await market.searchStocks(searchSchema.parse(req.query.q)));
export const quote = async (req, res) =>
  ok(res, await market.getQuote(symbolSchema.parse(req.params.symbol)));
export const history = async (req, res) =>
  ok(
    res,
    await market.getHistory(
      symbolSchema.parse(req.params.symbol),
      z.enum(['1W', '1M', '3M', '6M', '1Y']).default('1M').parse(req.query.range),
    ),
  );
