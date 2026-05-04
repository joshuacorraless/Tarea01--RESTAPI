import { Router } from "express";
import {
  createOrder,
  getOrderById,
  getMyOrders,
  addItemToOrder,
  updateOrderStatus,
} from "../controllers/order.controller";
import { authenticate } from "../middlewares/auth.middleware";
import { authorize } from "../middlewares/role.middleware";
import { validate } from "../middlewares/validate.middleware";
import {
  createOrderSchema,
  addOrderItemSchema,
  updateOrderStatusSchema,
} from "../schemas/menu-reservation-order.schema";

const router = Router();

router.get("/me", authenticate as any, getMyOrders as any);
router.post(
  "/",
  authenticate as any,
  authorize("client", "restaurant_admin") as any,
  validate(createOrderSchema),
  createOrder as any,
);
router.get("/:id", authenticate as any, getOrderById as any);
router.post(
  "/:id/items",
  authenticate as any,
  authorize("client", "restaurant_admin") as any,
  validate(addOrderItemSchema),
  addItemToOrder as any,
);
router.patch(
  "/:id/status",
  authenticate as any,
  authorize("restaurant_admin") as any,
  validate(updateOrderStatusSchema),
  updateOrderStatus as any,
);

export default router;
