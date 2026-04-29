import { Router } from 'express';
import searchRoutes from './search.route';

const router = Router();

router.use('/search', searchRoutes);

export default router;