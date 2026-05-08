import { Router } from 'express';
import { register, login } from '../controllers/auth.controller';
import { validate } from '../middlewares/validate.middleware';
import { registerSchema, loginSchema } from '../schemas/auth.schema';
import { loginLimiter, sensitiveLimiter } from '../middlewares/rateLimit.middleware';

const router = Router();

router.post('/register', sensitiveLimiter, validate(registerSchema), register);
router.post('/login', loginLimiter, validate(loginSchema), login);

export default router;
