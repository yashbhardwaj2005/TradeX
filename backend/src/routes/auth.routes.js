import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import * as controller from '../controllers/auth.controller.js';
import { authenticate } from '../middlewares/security.js';
export const authRouter = Router();
const limiter = rateLimit({
  windowMs: 15 * 60000,
  limit: 30,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: {
    success: false,
    error: { code: 'RATE_LIMITED', message: 'Too many authentication attempts. Try again later.' },
  },
});
authRouter.post('/register', limiter, controller.register);
authRouter.post('/login', limiter, controller.login);
authRouter.post('/refresh', controller.refresh);
authRouter.post('/logout', controller.logout);
authRouter.get('/me', authenticate, controller.me);
