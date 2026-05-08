import { Router } from "express";
import {
  createMenu,
  getMenuById,
  getMenusByRestaurant,
  updateMenu,
  deleteMenu,
  createMenuItem,
  getMenuItems,
  updateMenuItem,
  deleteMenuItem,
  getAllMenuItems,
} from "../controllers/menu.controller";
import { authenticate } from "../middlewares/auth.middleware";
import { authorize } from "../middlewares/role.middleware";
import { validate } from "../middlewares/validate.middleware";
import {
  createMenuSchema,
  updateMenuSchema,
  createMenuItemSchema,
  updateMenuItemSchema,
} from "../schemas/menu-reservation-order.schema";
import { cacheMiddleware } from "../middlewares/cache.middleware";
import { sensitiveLimiter } from "../middlewares/rateLimit.middleware";

const router = Router();

router.get("/restaurant/:restaurantId", cacheMiddleware(120) as any, getMenusByRestaurant);
router.get('/items/all', getAllMenuItems);
router.post(
  "/",
  sensitiveLimiter,
  authenticate as any,
  authorize("restaurant_admin") as any,
  validate(createMenuSchema),
  createMenu as any,
);

router.get("/:id", cacheMiddleware(120) as any, getMenuById);
router.put(
  "/:id",
  sensitiveLimiter,
  authenticate as any,
  authorize("restaurant_admin") as any,
  validate(updateMenuSchema),
  updateMenu as any,
);
router.delete(
  "/:id",
  sensitiveLimiter,
  authenticate as any,
  authorize("restaurant_admin") as any,
  deleteMenu as any,
);

// items del menu
router.get("/:menuId/items", cacheMiddleware(60) as any, getMenuItems);
router.post(
  "/:menuId/items",
  sensitiveLimiter,
  authenticate as any,
  authorize("restaurant_admin") as any,
  validate(createMenuItemSchema),
  createMenuItem as any,
);
router.put(
  "/:menuId/items/:itemId",
  sensitiveLimiter,
  authenticate as any,
  authorize("restaurant_admin") as any,
  validate(updateMenuItemSchema),
  updateMenuItem as any,
);
router.delete(
  "/:menuId/items/:itemId",
  sensitiveLimiter,
  authenticate as any,
  authorize("restaurant_admin") as any,
  deleteMenuItem as any,
);

export default router;