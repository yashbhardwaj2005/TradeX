import { inTransaction } from '../utils/transaction.js';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';

import { createHash, randomUUID } from 'node:crypto';
import { env } from '../config/env.js';
import { User, TokenSession, Watchlist, Snapshot } from '../models/index.js';
import { AppError, requireValue } from '../utils/errors.js';
export const hashToken = (token) => createHash('sha256').update(token).digest('hex');
export const publicUser = (user) => ({
  id: String(user._id),
  fullName: user.fullName,
  email: user.email,
  virtualBalance: user.virtualBalance,
  createdAt: user.createdAt,
});
export async function issueTokens(user, familyId = randomUUID(), session) {
  const accessToken = jwt.sign({}, env.JWT_ACCESS_SECRET, {
    subject: String(user._id),
    expiresIn: '10m',
    issuer: 'tradeforge',
    audience: 'tradeforge-api',
    algorithm: 'HS256',
  });
  const refreshToken = jwt.sign({ familyId }, env.JWT_REFRESH_SECRET, {
    subject: String(user._id),
    jwtid: randomUUID(),
    expiresIn: '7d',
    issuer: 'tradeforge',
    audience: 'tradeforge-refresh',
    algorithm: 'HS256',
  });
  await TokenSession.create(
    [
      {
        userId: user._id,
        familyId,
        tokenHash: hashToken(refreshToken),
        expiresAt: new Date(Date.now() + 7 * 86400000),
      },
    ],
    { session },
  );
  return { accessToken, refreshToken, user: publicUser(user) };
}
export async function register(input) {
  const passwordHash = await bcrypt.hash(input.password, 12);
  return inTransaction(async (session) => {
    const [user] = await User.create(
      [{ fullName: input.fullName, email: input.email, passwordHash }],
      { session },
    );
    await Watchlist.create([{ userId: user._id }], { session });
    await Snapshot.create(
      [
        {
          userId: user._id,
          bucket: 'initial',
          cash: 100000000,
          holdingsValue: 0,
          equity: 100000000,
          source: 'simulated',
          quoteTimestamp: new Date(),
        },
      ],
      { session },
    );
    return { user: publicUser(user) };
  });
}
const dummyHash = await bcrypt.hash('tradeforge-dummy-password', 12);
export async function login(input) {
  const user = await User.findOne({ email: input.email }).select('+passwordHash');
  const valid = await bcrypt.compare(input.password, user?.passwordHash || dummyHash);
  requireValue(user && valid, 401, 'INVALID_CREDENTIALS', 'Email or password is incorrect.');
  return issueTokens(user);
}
export async function refresh(token) {
  let claims;
  try {
    claims = jwt.verify(token, env.JWT_REFRESH_SECRET, {
      algorithms: ['HS256'],
      issuer: 'tradeforge',
      audience: 'tradeforge-refresh',
    });
  } catch {
    throw new AppError(401, 'SESSION_EXPIRED', 'Your session has expired. Please sign in again.');
  }
  const result = await inTransaction(async (session) => {
    const old = await TokenSession.findOneAndUpdate(
      { tokenHash: hashToken(token), revokedAt: null, expiresAt: { $gt: new Date() } },
      { $set: { revokedAt: new Date() } },
      { new: true, session },
    );
    if (!old) {
      await TokenSession.updateMany(
        { familyId: claims.familyId },
        { $set: { revokedAt: new Date() } },
        { session },
      );
      return null;
    }
    const user = await User.findById(claims.sub).session(session);
    requireValue(user, 401, 'SESSION_EXPIRED', 'Account not found.');
    return issueTokens(user, old.familyId, session);
  });
  requireValue(result, 401, 'TOKEN_REUSED', 'Session was revoked. Please sign in again.');
  return result;
}
export async function logout(token) {
  if (!token) return;
  const record = await TokenSession.findOne({ tokenHash: hashToken(token) });
  if (record)
    await TokenSession.updateMany(
      { familyId: record.familyId },
      { $set: { revokedAt: new Date() } },
    );
}
