import { Request, Response } from 'express';
import { AuthenticatedRequest } from '../middlewares/auth.middleware';
import { createRestaurant, listRestaurants } from '../services/restaurant.service';
import { sendSuccess, sendError } from '../utils/response';
import { invalidateCache } from '../middlewares/cache.middleware';

export async function create(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const restaurant = await createRestaurant(req.user!.sub, req.body);
    await invalidateCache('cache:/api/restaurants');
    sendSuccess(res, restaurant, 'restaurant created successfully', 201);
  } catch (error: any) {
    sendError(res, error.message, 500);
  }
}

export async function list(_req: Request, res: Response): Promise<void> {
  try {
    const restaurants = await listRestaurants();
    sendSuccess(res, restaurants, 'restaurants retrieved');
  } catch (error: any) {
    sendError(res, error.message, 500);
  }
}
