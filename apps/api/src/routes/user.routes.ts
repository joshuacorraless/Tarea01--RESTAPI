import { Router } from 'express';
import { getMe, update, remove } from '../controllers/user.controller';
import { authenticate } from '../middlewares/auth.middleware';
import { validate } from '../middlewares/validate.middleware';
import { updateUserSchema } from '../schemas/user.schema';
import { sensitiveLimiter } from '../middlewares/rateLimit.middleware';

const router = Router();

router.use(authenticate as any);

router.get('/me', getMe as any);
router.put('/:id', sensitiveLimiter, validate(updateUserSchema), update as any);
router.delete('/:id', sensitiveLimiter, remove as any);

export default router;
