import { z } from 'zod';
export const registerSchema = z
  .object({
    fullName: z.string().trim().min(2).max(80),
    email: z.email().trim().toLowerCase().max(254),
    password: z
      .string()
      .min(10)
      .max(72)
      .refine((v) => Buffer.byteLength(v) <= 72, 'Password must be at most 72 UTF-8 bytes'),
  })
  .strict();
export const loginSchema = registerSchema.pick({ email: true, password: true });
export const symbolSchema = z
  .string()
  .trim()
  .toUpperCase()
  .regex(/^[A-Z0-9&-]{1,24}\.NSE$/);
export const orderSchema = z
  .object({
    symbol: symbolSchema,
    side: z.enum(['BUY', 'SELL']),
    orderType: z.enum(['MARKET', 'LIMIT']).default('MARKET'),
    quantity: z.number().int().min(1).max(100000),
    limitPrice: z.number().int().min(1).max(1000000000).optional(),
  })
  .strict()
  .refine(
    (v) => v.orderType !== 'LIMIT' || !!v.limitPrice,
    'A limit order requires a limitPrice in integer paise',
  );
export const alertSchema = z
  .object({
    symbol: symbolSchema,
    condition: z.enum(['GTE', 'LTE']),
    targetPrice: z.number().int().min(1).max(1000000000),
  })
  .strict();
export const pageSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(12),
  side: z.enum(['BUY', 'SELL']).optional(),
  status: z.enum(['PENDING', 'FILLED', 'CANCELLED', 'REJECTED']).optional(),
  symbol: symbolSchema.optional(),
  from: z.iso.date().optional(),
  to: z.iso.date().optional(),
  sort: z.enum(['asc', 'desc']).default('desc'),
});
