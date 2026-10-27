import { Router } from 'express';
import { authenticate } from '../middlewares/security.js';
import * as controller from '../controllers/portfolio.controller.js';
export const portfolioRouter = Router();
portfolioRouter.use(authenticate);
portfolioRouter.get('/', controller.portfolio);
portfolioRouter.get('/holdings', controller.holdings);
portfolioRouter.get('/analytics', controller.analytics);
