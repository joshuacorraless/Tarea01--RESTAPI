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

const router = Router();

// ── rutas fijas primero (antes de cualquier /:param) ──────────────────────────

// menus — cache 2 minutos en GETs publicos
router.get("/restaurant/:restaurantId", cacheMiddleware(120) as any, getMenusByRestaurant);
router.post(
  "/",
  authenticate as any,
  authorize("restaurant_admin") as any,
  validate(createMenuSchema),
  createMenu as any,
);

// ── rutas con /:id despues ────────────────────────────────────────────────────

router.get("/:id", cacheMiddleware(120) as any, getMenuById);
router.put(
  "/:id",
  authenticate as any,
  authorize("restaurant_admin") as any,
  validate(updateMenuSchema),
  updateMenu as any,
);
router.delete(
  "/:id",
  authenticate as any,
  authorize("restaurant_admin") as any,
  deleteMenu as any,
);

// ── items del menu ────────────────────────────────────────────────────────────

router.get("/:menuId/items", cacheMiddleware(60) as any, getMenuItems);
router.post(
  "/:menuId/items",
  authenticate as any,
  authorize("restaurant_admin") as any,
  validate(createMenuItemSchema),
  createMenuItem as any,
);
router.put(
  "/:menuId/items/:itemId",
  authenticate as any,
  authorize("restaurant_admin") as any,
  validate(updateMenuItemSchema),
  updateMenuItem as any,
);
router.delete(
  "/:menuId/items/:itemId",
  authenticate as any,
  authorize("restaurant_admin") as any,
  deleteMenuItem as any,
);

export default router;
