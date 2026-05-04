import { Router } from "express";
import {
  createReservation,
  getReservationById,
  getMyReservations,
  getReservationsByRestaurant,
  cancelReservation,
  getAvailableTables,
} from "../controllers/reservation.controller";
import { authenticate } from "../middlewares/auth.middleware";
import { authorize } from "../middlewares/role.middleware";
import { validate } from "../middlewares/validate.middleware";
import { createReservationSchema } from "../schemas/menu-reservation-order.schema";

const router = Router();

router.get("/available-tables", getAvailableTables);
router.get("/me", authenticate as any, getMyReservations as any);
router.get(
  "/restaurant/:restaurantId",
  authenticate as any,
  authorize("restaurant_admin", "client") as any,
  getReservationsByRestaurant as any,
);
router.post(
  "/",
  authenticate as any,
  authorize("client", "restaurant_admin") as any,
  validate(createReservationSchema),
  createReservation as any,
);
router.get("/:id", authenticate as any, getReservationById as any);
router.delete(
  "/:id",
  authenticate as any,
  authorize("client", "restaurant_admin") as any,
  cancelReservation as any,
);

export default router;
