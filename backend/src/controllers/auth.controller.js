import { env } from '../config/env.js';
import { registerSchema, loginSchema } from '../validators/index.js';
import * as auth from '../services/auth.service.js';
import { User } from '../models/index.js';
import { ok, requireValue } from '../utils/errors.js';
const cookieOptions = {
  httpOnly: true,
  secure: env.COOKIE_SECURE,
  sameSite: env.COOKIE_SAME_SITE,
  path: '/api/v1/auth',
};
function sendTokens(res, tokens, status = 200) {
  res.cookie('tf_refresh', tokens.refreshToken, { ...cookieOptions, maxAge: 7 * 86400000 });
  return ok(res, { accessToken: tokens.accessToken, user: tokens.user }, status);
}
export const register = async (req, res) =>
  sendTokens(res, await auth.register(registerSchema.parse(req.body)), 201);
export const login = async (req, res) =>
  sendTokens(res, await auth.login(loginSchema.parse(req.body)));
export const refresh = async (req, res) =>
  sendTokens(res, await auth.refresh(req.cookies.tf_refresh));
export const logout = async (req, res) => {
  await auth.logout(req.cookies.tf_refresh);
  res.clearCookie('tf_refresh', cookieOptions);
  ok(res, { message: 'Signed out.' });
};
export const me = async (req, res) =>
  ok(
    res,
    auth.publicUser(
      requireValue(await User.findById(req.userId), 401, 'UNAUTHORIZED', 'Account not found.'),
    ),
  );
