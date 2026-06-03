import { Router } from 'express';
import { getTopStocks, getStockData, readArticle } from '../controllers/stock.controller';
import { authenticateToken } from '../middlewares/auth.middleware';
import { apiLimiter } from '../middlewares/rateLimiter.middleware';

const router = Router();
router.get('/top-stocks', authenticateToken, apiLimiter, getTopStocks);
router.get('/search/:ticker', authenticateToken, apiLimiter, getStockData);
router.post('/read-article', authenticateToken, apiLimiter, readArticle);
export default router;