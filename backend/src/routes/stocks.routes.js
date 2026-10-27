import { Router } from 'express';
import * as controller from '../controllers/stocks.controller.js';
export const stocksRouter = Router();
stocksRouter.get('/', controller.list);
stocksRouter.get('/search', controller.search);
stocksRouter.get('/:symbol/history', controller.history);
stocksRouter.get('/:symbol', controller.quote);
