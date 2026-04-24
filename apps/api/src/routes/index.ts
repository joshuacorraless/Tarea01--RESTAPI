import { Router } from 'express';
import authRoutes from './auth.routes';
import userRoutes from './user.routes';
import restaurantRoutes from './restaurant.routes';
import menuRoutes from './menu.routes';
import reservationRoutes from './reservation.routes';
import orderRoutes from './order.routes';

const router = Router();

router.use('/auth', authRoutes);
router.use('/users', userRoutes);
router.use('/restaurants', restaurantRoutes);
router.use('/menus', menuRoutes);
router.use('/reservations', reservationRoutes);
router.use('/orders', orderRoutes);

export default router;