import { Response } from "express";
import { AuthenticatedRequest } from "../middlewares/auth.middleware";
import {
  createOrderService,
  getOrderByIdService,
  getOrdersByClientService,
  addItemToOrderService,
  updateOrderStatusService,
} from "../services/order.service";
import { sendSuccess, sendError } from "../utils/response";

export async function createOrder(
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> {
  try {
    const order = await createOrderService({
      ...req.body,
      idCliente: req.user!.sub,
    });
    sendSuccess(res, order, "orden creada exitosamente", 201);
  } catch (error: any) {
    sendError(res, error.message, 500);
  }
}

export async function getOrderById(
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> {
  try {
    const order = await getOrderByIdService(req.params.id);
    if (!order) {
      sendError(res, "orden no encontrada", 404);
      return;
    }
    sendSuccess(res, order, "orden obtenida exitosamente");
  } catch (error: any) {
    sendError(res, error.message, 500);
  }
}

export async function getMyOrders(
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> {
  try {
    const orders = await getOrdersByClientService(req.user!.sub);
    sendSuccess(res, orders, "ordenes obtenidas exitosamente");
  } catch (error: any) {
    sendError(res, error.message, 500);
  }
}

export async function addItemToOrder(
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> {
  try {
    const result = await addItemToOrderService(req.params.id, req.body);
    sendSuccess(res, result, "producto agregado a la orden exitosamente", 201);
  } catch (error: any) {
    if (error.message?.includes("no encontrada")) {
      sendError(res, error.message, 404);
      return;
    }
    if (error.message?.includes("solo puede agregar")) {
      sendError(res, error.message, 409);
      return;
    }
    sendError(res, error.message, 500);
  }
}

export async function updateOrderStatus(
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> {
  try {
    const order = await updateOrderStatusService(
      req.params.id,
      req.body.status,
    );
    if (!order) {
      sendError(res, "orden no encontrada", 404);
      return;
    }
    sendSuccess(res, order, "estado de la orden actualizado exitosamente");
  } catch (error: any) {
    sendError(res, error.message, 500);
  }
}
