import { Router } from 'express';
import { getIncidents, acknowledgeIncident, resolveIncident } from '../controllers/admin.controller';
import { authenticateToken } from '../middlewares/auth.middleware';
import { apiLimiter } from '../middlewares/rateLimiter.middleware';

const router = Router();
router.get('/incidents', authenticateToken, getIncidents);
router.post('/incidents/:id/acknowledge', authenticateToken, apiLimiter, acknowledgeIncident);
router.post('/incidents/:id/resolve', authenticateToken, resolveIncident);
export default router;