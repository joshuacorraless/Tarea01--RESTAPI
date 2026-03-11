import { Response } from "express";
import { AuthenticatedRequest } from "../middlewares/auth.middleware";
import {
  createOrder,
  getOrderById,
  getMyOrders,
  addItemToOrder,
  updateOrderStatus,
} from "../controllers/order.controller";
import * as orderService from "../services/order.service";
import * as response from "../utils/response";

jest.mock("../services/order.service");
jest.mock("../utils/response");

const mockRes = () => ({}) as Response;
const mockReq = (opts: Partial<AuthenticatedRequest> = {}) =>
  ({
    body: {},
    params: {},
    user: { sub: "user-1" },
    ...opts,
  }) as AuthenticatedRequest;

describe("Order Controller", () => {
  beforeEach(() => jest.clearAllMocks());

  // ─── createOrder ───────────────────────────────────────────
  describe("POST /orders", () => {
    it("crea una orden e inyecta idCliente del JWT", async () => {
      const fakeOrder = { id: "o-1", idCliente: "user-1" };
      (orderService.createOrderService as jest.Mock).mockResolvedValue(
        fakeOrder,
      );

      await createOrder(mockReq({ body: { restaurantId: "r-1" } }), mockRes());

      expect(orderService.createOrderService).toHaveBeenCalledWith({
        restaurantId: "r-1",
        idCliente: "user-1",
      });
      expect(response.sendSuccess).toHaveBeenCalledWith(
        expect.anything(),
        fakeOrder,
        "orden creada exitosamente",
        201,
      );
    });

    it("responde 500 ante error inesperado", async () => {
      (orderService.createOrderService as jest.Mock).mockRejectedValue(
        new Error("DB error"),
      );

      await createOrder(mockReq(), mockRes());

      expect(response.sendError).toHaveBeenCalledWith(
        expect.anything(),
        "DB error",
        500,
      );
    });
  });

  // ─── getOrderById ──────────────────────────────────────────
  describe("GET /orders/:id", () => {
    it("retorna la orden si existe", async () => {
      const fakeOrder = { id: "o-1" };
      (orderService.getOrderByIdService as jest.Mock).mockResolvedValue(
        fakeOrder,
      );

      await getOrderById(mockReq({ params: { id: "o-1" } }), mockRes());

      expect(response.sendSuccess).toHaveBeenCalledWith(
        expect.anything(),
        fakeOrder,
        "orden obtenida exitosamente",
      );
    });

    it("responde 404 si la orden no existe", async () => {
      (orderService.getOrderByIdService as jest.Mock).mockResolvedValue(null);

      await getOrderById(mockReq({ params: { id: "99" } }), mockRes());

      expect(response.sendError).toHaveBeenCalledWith(
        expect.anything(),
        "orden no encontrada",
        404,
      );
    });

    it("responde 500 ante error inesperado", async () => {
      (orderService.getOrderByIdService as jest.Mock).mockRejectedValue(
        new Error("DB error"),
      );

      await getOrderById(mockReq({ params: { id: "o-1" } }), mockRes());

      expect(response.sendError).toHaveBeenCalledWith(
        expect.anything(),
        "DB error",
        500,
      );
    });
  });

  // ─── getMyOrders ───────────────────────────────────────────
  describe("GET /orders/me", () => {
    it("retorna las órdenes del usuario autenticado", async () => {
      const fakeOrders = [{ id: "o-1" }, { id: "o-2" }];
      (orderService.getOrdersByClientService as jest.Mock).mockResolvedValue(
        fakeOrders,
      );

      await getMyOrders(mockReq(), mockRes());

      expect(orderService.getOrdersByClientService).toHaveBeenCalledWith(
        "user-1",
      );
      expect(response.sendSuccess).toHaveBeenCalledWith(
        expect.anything(),
        fakeOrders,
        "ordenes obtenidas exitosamente",
      );
    });

    it("responde 500 ante error inesperado", async () => {
      (orderService.getOrdersByClientService as jest.Mock).mockRejectedValue(
        new Error("DB error"),
      );

      await getMyOrders(mockReq(), mockRes());

      expect(response.sendError).toHaveBeenCalledWith(
        expect.anything(),
        "DB error",
        500,
      );
    });
  });

  // ─── addItemToOrder ────────────────────────────────────────
  describe("POST /orders/:id/items", () => {
    it("agrega un item a la orden y responde 201", async () => {
      const fakeResult = { orderId: "o-1", itemId: "i-1" };
      (orderService.addItemToOrderService as jest.Mock).mockResolvedValue(
        fakeResult,
      );

      await addItemToOrder(
        mockReq({ params: { id: "o-1" }, body: { itemId: "i-1" } }),
        mockRes(),
      );

      expect(orderService.addItemToOrderService).toHaveBeenCalledWith("o-1", {
        itemId: "i-1",
      });
      expect(response.sendSuccess).toHaveBeenCalledWith(
        expect.anything(),
        fakeResult,
        "producto agregado a la orden exitosamente",
        201,
      );
    });

    it("responde 404 si la orden no es encontrada", async () => {
      (orderService.addItemToOrderService as jest.Mock).mockRejectedValue(
        new Error("orden no encontrada"),
      );

      await addItemToOrder(mockReq({ params: { id: "99" } }), mockRes());

      expect(response.sendError).toHaveBeenCalledWith(
        expect.anything(),
        "orden no encontrada",
        404,
      );
    });

    it("responde 409 si el cliente solo puede agregar a su orden", async () => {
      (orderService.addItemToOrderService as jest.Mock).mockRejectedValue(
        new Error("solo puede agregar items a sus propias ordenes"),
      );

      await addItemToOrder(mockReq({ params: { id: "o-1" } }), mockRes());

      expect(response.sendError).toHaveBeenCalledWith(
        expect.anything(),
        "solo puede agregar items a sus propias ordenes",
        409,
      );
    });

    it("responde 500 ante error genérico", async () => {
      (orderService.addItemToOrderService as jest.Mock).mockRejectedValue(
        new Error("DB error"),
      );

      await addItemToOrder(mockReq({ params: { id: "o-1" } }), mockRes());

      expect(response.sendError).toHaveBeenCalledWith(
        expect.anything(),
        "DB error",
        500,
      );
    });
  });

  // ─── updateOrderStatus ─────────────────────────────────────
  describe("PUT /orders/:id/status", () => {
    it("actualiza el estado de la orden", async () => {
      const updated = { id: "o-1", status: "completed" };
      (orderService.updateOrderStatusService as jest.Mock).mockResolvedValue(
        updated,
      );

      await updateOrderStatus(
        mockReq({ params: { id: "o-1" }, body: { status: "completed" } }),
        mockRes(),
      );

      expect(orderService.updateOrderStatusService).toHaveBeenCalledWith(
        "o-1",
        "completed",
      );
      expect(response.sendSuccess).toHaveBeenCalledWith(
        expect.anything(),
        updated,
        "estado de la orden actualizado exitosamente",
      );
    });

    it("responde 404 si la orden no existe", async () => {
      (orderService.updateOrderStatusService as jest.Mock).mockResolvedValue(
        null,
      );

      await updateOrderStatus(mockReq({ params: { id: "99" } }), mockRes());

      expect(response.sendError).toHaveBeenCalledWith(
        expect.anything(),
        "orden no encontrada",
        404,
      );
    });

    it("responde 500 ante error inesperado", async () => {
      (orderService.updateOrderStatusService as jest.Mock).mockRejectedValue(
        new Error("DB error"),
      );

      await updateOrderStatus(mockReq({ params: { id: "o-1" } }), mockRes());

      expect(response.sendError).toHaveBeenCalledWith(
        expect.anything(),
        "DB error",
        500,
      );
    });
  });
});
