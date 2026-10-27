import jwt from 'jsonwebtoken';
import { env, origins } from '../config/env.js';
import { AppError } from '../utils/errors.js';
export function originGuard(req, res, next) {
  if (
    !['GET', 'HEAD', 'OPTIONS'].includes(req.method) &&
    req.headers.origin &&
    !origins.includes(req.headers.origin)
  )
    return next(new AppError(403, 'ORIGIN_DENIED', 'Request origin is not allowed.'));
  if (
    !['GET', 'HEAD', 'OPTIONS'].includes(req.method) &&
    req.headers['sec-fetch-site'] === 'cross-site' &&
    !origins.includes(req.headers.origin)
  )
    return next(new AppError(403, 'CSRF_BLOCKED', 'Cross-site request denied.'));
  next();
}
export function authenticate(req, res, next) {
  try {
    const token = req.headers.authorization?.match(/^Bearer (.+)$/)?.[1];
    if (!token) throw new Error();
    const payload = jwt.verify(token, env.JWT_ACCESS_SECRET, {
      algorithms: ['HS256'],
      issuer: 'tradeforge',
      audience: 'tradeforge-api',
    });
    req.userId = payload.sub;
    next();
  } catch {
    next(new AppError(401, 'UNAUTHORIZED', 'Please sign in to continue.'));
  }
}
export function errorHandler(error, req, res, next) {
  if (res.headersSent) return next(error);
  if (error.name === 'ZodError')
    return res.status(400).json({
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: error.issues
          .map((i) => `${i.path.join('.') || 'Request'}: ${i.message}`)
          .join('; '),
      },
    });
  if (error.code === 11000)
    return res.status(409).json({
      success: false,
      error: { code: 'CONFLICT', message: 'This record already exists.' },
    });
  const status = error.status || (error.type === 'entity.parse.failed' ? 400 : 500);
  if (status >= 500)
    console.error(
      JSON.stringify({
        level: 'error',
        method: req.method,
        path: req.path,
        message: error.message,
      }),
    );
  res.status(status).json({
    success: false,
    error: {
      code: error.code || 'INTERNAL_ERROR',
      message:
        status >= 500 && !(error instanceof AppError)
          ? 'Something went wrong. Please try again.'
          : error.message,
    },
  });
}
