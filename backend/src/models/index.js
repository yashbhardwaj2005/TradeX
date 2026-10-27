import mongoose from 'mongoose';
const { Schema, model } = mongoose;
const owner = { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true };
const money = { type: Number, required: true, min: 0, validate: Number.isSafeInteger };
const integer = { type: Number, required: true, min: 0, validate: Number.isSafeInteger };
const userSchema = new Schema(
  {
    fullName: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    passwordHash: { type: String, required: true, select: false },
    virtualBalance: { ...money, default: 100000000 },
    accountVersion: { type: Number, default: 0 },
  },
  { timestamps: true },
);
export const User = model('User', userSchema);
const sessionSchema = new Schema(
  {
    userId: owner,
    tokenHash: { type: String, required: true, unique: true },
    familyId: { type: String, required: true, index: true },
    expiresAt: { type: Date, required: true, expires: 0 },
    revokedAt: Date,
  },
  { timestamps: true },
);
export const TokenSession = model('TokenSession', sessionSchema);
const holdingSchema = new Schema(
  { userId: owner, symbol: { type: String, required: true }, quantity: integer, costBasis: money },
  { timestamps: true },
);
holdingSchema.index({ userId: 1, symbol: 1 }, { unique: true });
export const Holding = model('Holding', holdingSchema);
const orderSchema = new Schema(
  {
    userId: owner,
    symbol: { type: String, required: true },
    side: { type: String, enum: ['BUY', 'SELL'], required: true },
    orderType: { type: String, enum: ['MARKET', 'LIMIT'], required: true },
    quantity: integer,
    limitPrice: Number,
    status: {
      type: String,
      enum: ['PENDING', 'FILLED', 'CANCELLED', 'REJECTED'],
      default: 'PENDING',
    },
    idempotencyKey: { type: String, required: true },
    requestHash: { type: String, required: true },
    executionPrice: Number,
    executedAt: Date,
    rejectionReason: String,
    quoteSource: String,
    quoteTimestamp: Date,
  },
  { timestamps: true },
);
orderSchema.index({ userId: 1, idempotencyKey: 1 }, { unique: true });
orderSchema.index({ status: 1, createdAt: 1 });
export const Order = model('Order', orderSchema);
const transactionSchema = new Schema(
  {
    userId: owner,
    orderId: { type: Schema.Types.ObjectId, ref: 'Order', required: true, unique: true },
    symbol: String,
    side: String,
    quantity: integer,
    executionPrice: money,
    grossAmount: money,
    fees: { ...money, default: 0 },
    costBasis: money,
    realizedPnL: { type: Number, required: true, validate: Number.isSafeInteger },
    executedAt: { type: Date, required: true },
    quoteSource: String,
  },
  { timestamps: true },
);
transactionSchema.index({ userId: 1, executedAt: -1 });
export const Transaction = model('Transaction', transactionSchema);
const watchlistSchema = new Schema(
  {
    userId: { ...owner, unique: true },
    name: { type: String, default: 'My watchlist' },
    symbols: { type: [String], default: [] },
  },
  { timestamps: true },
);
export const Watchlist = model('Watchlist', watchlistSchema);
const alertSchema = new Schema(
  {
    userId: owner,
    symbol: String,
    condition: { type: String, enum: ['GTE', 'LTE'] },
    targetPrice: money,
    isActive: { type: Boolean, default: true },
    triggeredAt: Date,
  },
  { timestamps: true },
);
alertSchema.index({ isActive: 1, symbol: 1 });
export const PriceAlert = model('PriceAlert', alertSchema);
export const Notification = model(
  'Notification',
  new Schema(
    {
      userId: owner,
      alertId: { type: Schema.Types.ObjectId, unique: true },
      title: String,
      message: String,
      readAt: Date,
    },
    { timestamps: true },
  ),
);
const snapshotSchema = new Schema(
  {
    userId: owner,
    bucket: String,
    cash: money,
    holdingsValue: money,
    equity: money,
    source: String,
    quoteTimestamp: Date,
  },
  { timestamps: true },
);
snapshotSchema.index({ userId: 1, bucket: 1 }, { unique: true });
export const Snapshot = model('Snapshot', snapshotSchema);
export async function initializeModels() {
  await Promise.all(mongoose.modelNames().map((name) => mongoose.model(name).init()));
}
