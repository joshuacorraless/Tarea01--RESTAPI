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

router.get("/me", authenticate as any, getMyOrders as any); // ver mis ordenes
router.post(
  // crear una orden
  "/",
  authenticate as any,
  authorize("client", "restaurant_admin") as any,
  validate(createOrderSchema),
  createOrder as any,
);
router.get("/:id", authenticate as any, getOrderById as any); // ver una orden especifica
router.post(
  // agregar un item a una orden
  "/:id/items",
  authenticate as any,
  authorize("client", "restaurant_admin") as any,
  validate(addOrderItemSchema),
  addItemToOrder as any,
);
router.patch(
  // actualizar el estado de una orden
  "/:id/status",
  authenticate as any,
  authorize("restaurant_admin") as any,
  validate(updateOrderStatusSchema),
  updateOrderStatus as any,
);

export default router;
