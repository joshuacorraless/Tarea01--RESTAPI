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

router.get("/available-tables", getAvailableTables); // obtener mesas disponibles
router.get("/me", authenticate as any, getMyReservations as any); // ver mis reservas
router.get(
  // ver reservas de un restaurante
  "/restaurant/:restaurantId",
  authenticate as any,
  authorize("restaurant_admin", "client") as any,
  getReservationsByRestaurant as any,
);
router.post(
  // crear una reserva
  "/",
  authenticate as any,
  authorize("client", "restaurant_admin") as any,
  validate(createReservationSchema),
  createReservation as any,
);
router.get("/:id", authenticate as any, getReservationById as any); // ver una reserva especifica
router.delete(
  // cancelar una reserva
  "/:id",
  authenticate as any,
  authorize("client", "restaurant_admin") as any,
  cancelReservation as any,
);

export default router;
