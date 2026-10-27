import { Order, Transaction } from '../models/index.js';
import { pageSchema } from '../validators/index.js';
import { requireValue } from '../utils/errors.js';
export async function listHistory(userId, rawQuery, type) {
  const { page, limit, side, status, symbol, from, to, sort } = pageSchema.parse(rawQuery);
  requireValue(
    !from || !to || from <= to,
    400,
    'INVALID_DATE_RANGE',
    'The start date must be on or before the end date.',
  );
  const query = { userId };
  if (side) query.side = side;
  if (symbol) query.symbol = symbol;
  if (status && type === 'orders') query.status = status;
  const field = type === 'orders' ? 'createdAt' : 'executedAt';
  if (from || to) {
    query[field] = {};
    if (from) query[field].$gte = new Date(`${from}T00:00:00+05:30`);
    if (to) query[field].$lt = new Date(new Date(`${to}T00:00:00+05:30`).getTime() + 86400000);
  }
  const Model = type === 'orders' ? Order : Transaction,
    direction = sort === 'asc' ? 1 : -1;
  const [items, total] = await Promise.all([
    Model.find(query)
      .sort({ [field]: direction, _id: direction })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
    Model.countDocuments(query),
  ]);
  return { items, total, page, limit, totalPages: Math.ceil(total / limit) };
}
export async function orderDetails(userId, id) {
  return requireValue(
    await Order.findOne({ _id: id, userId }).lean(),
    404,
    'ORDER_NOT_FOUND',
    'Order not found.',
  );
}
