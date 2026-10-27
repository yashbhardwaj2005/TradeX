import { Router } from 'express';
import { authenticate } from '../middlewares/security.js';
import { submit, cancel } from '../controllers/trading.controller.js';
export const tradingRouter = Router();
tradingRouter.use(authenticate);
tradingRouter.post('/trades/buy', submit('BUY'));
tradingRouter.post('/trades/sell', submit('SELL'));
tradingRouter.post('/orders', submit());
tradingRouter.delete('/orders/:id', cancel);
