import { Request, Response } from "express";
import { AuthenticatedRequest } from "../middlewares/auth.middleware";
import {
  createReservationService,
  getReservationByIdService,
  getReservationsByClientService,
  getReservationsByRestaurantService,
  cancelReservationService,
  getAvailableTablesService,
} from "../services/reservation.service";
import { sendSuccess, sendError } from "../utils/response";

export async function getAvailableTables(
  req: Request,
  res: Response,
): Promise<void> {
  try {
    const { restaurantId, reservadoPara, duracion } = req.query;
    if (!restaurantId || !reservadoPara) {
      sendError(
        res,
        "ID del restaurante y fecha de reserva son necesarios",
        400,
      );
      return;
    }
    const tables = await getAvailableTablesService(
      restaurantId as string,
      new Date(reservadoPara as string),
      duracion ? parseInt(duracion as string, 10) : 90,
    );
    sendSuccess(res, tables, "Mesas disponibles obtenidas exitosamente");
  } catch (error: any) {
    sendError(res, error.message, 500);
  }
}

export async function createReservation(
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> {
  try {
    const reservation = await createReservationService({
      ...req.body,
      idCliente: req.user!.sub,
    });
    sendSuccess(res, reservation, "Reserva creada exitosamente", 201);
  } catch (error: any) {
    if (
      error.message?.includes("no encontrado") ||
      error.message?.includes("no disponible")
    ) {
      sendError(res, error.message, 409);
      return;
    }
    sendError(res, error.message, 500);
  }
}

export async function getReservationById(
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> {
  try {
    const reservation = await getReservationByIdService(req.params.id);
    if (!reservation) {
      sendError(res, "Reserva no encontrada", 404);
      return;
    }
    sendSuccess(res, reservation, "Reserva obtenida exitosamente");
  } catch (error: any) {
    sendError(res, error.message, 500);
  }
}

export async function getMyReservations(
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> {
  try {
    const reservations = await getReservationsByClientService(req.user!.sub);
    sendSuccess(res, reservations, "Reservas obtenidas exitosamente");
  } catch (error: any) {
    sendError(res, error.message, 500);
  }
}

export async function getReservationsByRestaurant(
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> {
  try {
    const reservations = await getReservationsByRestaurantService(
      req.params.restaurantId,
    );
    sendSuccess(res, reservations, "Reservas obtenidas exitosamente");
  } catch (error: any) {
    sendError(res, error.message, 500);
  }
}

export async function cancelReservation(
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> {
  try {
    const reservation = await cancelReservationService(
      req.params.id,
      req.user!.sub,
    );
    if (!reservation) {
      sendError(res, "Reserva no encontrada o no se puede cancelar", 404);
      return;
    }
    sendSuccess(res, reservation, "Reserva cancelada exitosamente");
  } catch (error: any) {
    sendError(res, error.message, 500);
  }
}
