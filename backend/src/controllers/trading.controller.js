import { z } from 'zod';
import { submitOrder, cancelOrder } from '../services/trading.service.js';
import { ok } from '../utils/errors.js';
export const submit = (side) => async (req, res) =>
  ok(
    res,
    await submitOrder(
      req.userId,
      side ? { ...req.body, side } : req.body,
      req.headers['idempotency-key'],
    ),
    201,
  );
export const cancel = async (req, res) =>
  ok(
    res,
    await cancelOrder(
      req.userId,
      z
        .string()
        .regex(/^[a-f\d]{24}$/i)
        .parse(req.params.id),
    ),
  );
