import { getPortfolio, getAnalytics } from '../services/portfolio.service.js';
import { ok } from '../utils/errors.js';
export const portfolio = async (req, res) => ok(res, await getPortfolio(req.userId));
export const holdings = async (req, res) => ok(res, (await getPortfolio(req.userId)).holdings);
export const analytics = async (req, res) => ok(res, await getAnalytics(req.userId));
