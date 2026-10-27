import { z } from 'zod';
import { symbolSchema } from '../validators/index.js';
import { ok, requireValue } from '../utils/errors.js';
import * as history from '../services/history.service.js';
import * as watchlist from '../services/watchlist.service.js';
import { User } from '../models/index.js';
import { publicUser } from '../services/auth.service.js';
export const orders = async (req, res) =>
  ok(res, await history.listHistory(req.userId, req.query, 'orders'));
export const transactions = async (req, res) =>
  ok(res, await history.listHistory(req.userId, req.query, 'transactions'));
export const order = async (req, res) =>
  ok(
    res,
    await history.orderDetails(
      req.userId,
      z
        .string()
        .regex(/^[a-f\d]{24}$/i)
        .parse(req.params.id),
    ),
  );
export const list = async (req, res) => ok(res, await watchlist.getWatchlist(req.userId));
export const add = async (req, res) => {
  const { symbol } = z.object({ symbol: symbolSchema }).strict().parse(req.body);
  ok(res, await watchlist.addToWatchlist(req.userId, symbol), 201);
};
export const remove = async (req, res) =>
  ok(res, await watchlist.removeFromWatchlist(req.userId, symbolSchema.parse(req.params.symbol)));
export const profile = async (req, res) => {
  const input = z
    .object({ fullName: z.string().trim().min(2).max(80) })
    .strict()
    .parse(req.body);
  ok(
    res,
    publicUser(
      requireValue(
        await User.findByIdAndUpdate(
          req.userId,
          { $set: input },
          { new: true, runValidators: true },
        ),
        401,
        'UNAUTHORIZED',
        'Account not found.',
      ),
    ),
  );
};
