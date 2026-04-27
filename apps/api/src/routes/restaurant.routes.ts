import { Router } from 'express';
import { create, list } from '../controllers/restaurant.controller';
import { authenticate } from '../middlewares/auth.middleware';
import { authorize } from '../middlewares/role.middleware';
import { validate } from '../middlewares/validate.middleware';
import { createRestaurantSchema } from '../schemas/restaurant.schema';
import { cacheMiddleware } from '../middlewares/cache.middleware';

const router = Router();

// get es publico con cache de 2 minutos; post requiere autenticacion + rol restaurant_admin
router.get('/', cacheMiddleware(120) as any, list);
router.post(
  '/',
  authenticate as any,
  authorize('restaurant_admin') as any,
  validate(createRestaurantSchema),
  create as any
);

export default router;
