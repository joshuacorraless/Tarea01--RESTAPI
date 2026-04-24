import { Router } from 'express';
import { getMe, update, remove } from '../controllers/user.controller';
import { authenticate } from '../middlewares/auth.middleware';
import { validate } from '../middlewares/validate.middleware';
import { updateUserSchema } from '../schemas/user.schema';

const router = Router();

// todos los endpoints de users requieren autenticacion
router.use(authenticate as any);

router.get('/me', getMe as any);
router.put('/:id', validate(updateUserSchema), update as any);
router.delete('/:id', remove as any);

export default router;
