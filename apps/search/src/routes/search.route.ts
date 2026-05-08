import { Router } from 'express';
import * as controller from '../controllers/search.controller';
import { searchLimiter } from '../middlewares/rate-limiter.middleware';

const router = Router();

router.get('/products', searchLimiter, controller.searchByText);
router.get('/products/category/:categoria', searchLimiter, controller.searchByCategory);
router.post('/reindex', controller.reindex);

export default router;