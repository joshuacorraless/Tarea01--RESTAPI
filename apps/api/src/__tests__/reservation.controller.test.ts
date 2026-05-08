import { Request, Response } from "express";
import { AuthenticatedRequest } from "../middlewares/auth.middleware";
import {
  getAvailableTables,
  createReservation,
  getReservationById,
  getMyReservations,
  getReservationsByRestaurant,
  cancelReservation,
} from "../controllers/reservation.controller";
import * as reservationService from "../services/reservation.service";
import * as response from "../utils/response";

jest.mock("../services/reservation.service");
jest.mock("../utils/response");

const mockRes = () => ({}) as Response;
const mockReq = (opts: Partial<AuthenticatedRequest> = {}) =>
  ({
    body: {},
    params: {},
    query: {},
    user: { sub: "user-1" },
    ...opts,
  }) as AuthenticatedRequest;

describe("Reservation Controller", () => {
  beforeEach(() => jest.clearAllMocks());

  // getAvailableTables
  describe("GET /reservations/available", () => {
    it("retorna mesas disponibles con parámetros válidos", async () => {
      const fakeTables = [{ id: "t-1" }, { id: "t-2" }];
      (
        reservationService.getAvailableTablesService as jest.Mock
      ).mockResolvedValue(fakeTables);

      await getAvailableTables(
        mockReq({
          query: { restaurantId: "r-1", reservadoPara: "2026-03-15T19:00:00Z" },
        }) as Request,
        mockRes(),
      );

      expect(reservationService.getAvailableTablesService).toHaveBeenCalledWith(
        "r-1",
        new Date("2026-03-15T19:00:00Z"),
        90,
      );
      expect(response.sendSuccess).toHaveBeenCalledWith(
        expect.anything(),
        fakeTables,
        "Mesas disponibles obtenidas exitosamente",
      );
    });

    it("usa duración personalizada si se provee", async () => {
      (
        reservationService.getAvailableTablesService as jest.Mock
      ).mockResolvedValue([]);

      await getAvailableTables(
        mockReq({
          query: {
            restaurantId: "r-1",
            reservadoPara: "2026-03-15T19:00:00Z",
            duracion: "120",
          },
        }) as Request,
        mockRes(),
      );

      expect(reservationService.getAvailableTablesService).toHaveBeenCalledWith(
        "r-1",
        new Date("2026-03-15T19:00:00Z"),
        120,
      );
    });

    it("responde 400 si falta restaurantId", async () => {
      await getAvailableTables(
        mockReq({
          query: { reservadoPara: "2026-03-15T19:00:00Z" },
        }) as Request,
        mockRes(),
      );

      expect(response.sendError).toHaveBeenCalledWith(
        expect.anything(),
        "ID del restaurante y fecha de reserva son necesarios",
        400,
      );
    });

    it("responde 400 si falta reservadoPara", async () => {
      await getAvailableTables(
        mockReq({ query: { restaurantId: "r-1" } }) as Request,
        mockRes(),
      );

      expect(response.sendError).toHaveBeenCalledWith(
        expect.anything(),
        "ID del restaurante y fecha de reserva son necesarios",
        400,
      );
    });

    it("responde 500 ante error inesperado", async () => {
      (
        reservationService.getAvailableTablesService as jest.Mock
      ).mockRejectedValue(new Error("DB error"));

      await getAvailableTables(
        mockReq({
          query: { restaurantId: "r-1", reservadoPara: "2026-03-15T19:00:00Z" },
        }) as Request,
        mockRes(),
      );

      expect(response.sendError).toHaveBeenCalledWith(
        expect.anything(),
        "DB error",
        500,
      );
    });
  });

  // createReservation
  describe("POST /reservations", () => {
    it("crea una reserva e inyecta idCliente del JWT", async () => {
      const fakeReservation = { id: "res-1", idCliente: "user-1" };
      (
        reservationService.createReservationService as jest.Mock
      ).mockResolvedValue(fakeReservation);

      await createReservation(mockReq({ body: { tableId: "t-1" } }), mockRes());

      expect(reservationService.createReservationService).toHaveBeenCalledWith({
        tableId: "t-1",
        idCliente: "user-1",
      });
      expect(response.sendSuccess).toHaveBeenCalledWith(
        expect.anything(),
        fakeReservation,
        "Reserva creada exitosamente",
        201,
      );
    });

    it("responde 409 si el recurso no es encontrado", async () => {
      (
        reservationService.createReservationService as jest.Mock
      ).mockRejectedValue(new Error("mesa no encontrado"));

      await createReservation(mockReq(), mockRes());

      expect(response.sendError).toHaveBeenCalledWith(
        expect.anything(),
        "mesa no encontrado",
        409,
      );
    });

    it("responde 500 ante error genérico", async () => {
      (
        reservationService.createReservationService as jest.Mock
      ).mockRejectedValue(new Error("DB error"));

      await createReservation(mockReq(), mockRes());

      expect(response.sendError).toHaveBeenCalledWith(
        expect.anything(),
        "DB error",
        500,
      );
    });
  });

  // getReservationById
  describe("GET /reservations/:id", () => {
    it("retorna la reserva si existe", async () => {
      const fakeReservation = { id: "res-1" };
      (
        reservationService.getReservationByIdService as jest.Mock
      ).mockResolvedValue(fakeReservation);

      await getReservationById(mockReq({ params: { id: "res-1" } }), mockRes());

      expect(response.sendSuccess).toHaveBeenCalledWith(
        expect.anything(),
        fakeReservation,
        "Reserva obtenida exitosamente",
      );
    });

    it("responde 404 si la reserva no existe", async () => {
      (
        reservationService.getReservationByIdService as jest.Mock
      ).mockResolvedValue(null);

      await getReservationById(mockReq({ params: { id: "99" } }), mockRes());

      expect(response.sendError).toHaveBeenCalledWith(
        expect.anything(),
        "Reserva no encontrada",
        404,
      );
    });

    it("responde 500 ante error inesperado", async () => {
      (
        reservationService.getReservationByIdService as jest.Mock
      ).mockRejectedValue(new Error("DB error"));

      await getReservationById(mockReq({ params: { id: "res-1" } }), mockRes());

      expect(response.sendError).toHaveBeenCalledWith(
        expect.anything(),
        "DB error",
        500,
      );
    });
  });

  // getMyReservations
  describe("GET /reservations/me", () => {
    it("retorna las reservas del usuario autenticado", async () => {
      const fakeReservations = [{ id: "res-1" }, { id: "res-2" }];
      (
        reservationService.getReservationsByClientService as jest.Mock
      ).mockResolvedValue(fakeReservations);

      await getMyReservations(mockReq(), mockRes());

      expect(
        reservationService.getReservationsByClientService,
      ).toHaveBeenCalledWith("user-1");
      expect(response.sendSuccess).toHaveBeenCalledWith(
        expect.anything(),
        fakeReservations,
        "Reservas obtenidas exitosamente",
      );
    });

    it("responde 500 ante error inesperado", async () => {
      (
        reservationService.getReservationsByClientService as jest.Mock
      ).mockRejectedValue(new Error("DB error"));

      await getMyReservations(mockReq(), mockRes());

      expect(response.sendError).toHaveBeenCalledWith(
        expect.anything(),
        "DB error",
        500,
      );
    });
  });

  // getReservationsByRestaurant
  describe("GET /restaurants/:restaurantId/reservations", () => {
    it("retorna las reservas del restaurante", async () => {
      const fakeReservations = [{ id: "res-1" }];
      (
        reservationService.getReservationsByRestaurantService as jest.Mock
      ).mockResolvedValue(fakeReservations);

      await getReservationsByRestaurant(
        mockReq({ params: { restaurantId: "r-1" } }),
        mockRes(),
      );

      expect(
        reservationService.getReservationsByRestaurantService,
      ).toHaveBeenCalledWith("r-1");
      expect(response.sendSuccess).toHaveBeenCalledWith(
        expect.anything(),
        fakeReservations,
        "Reservas obtenidas exitosamente",
      );
    });

    it("responde 500 ante error inesperado", async () => {
      (
        reservationService.getReservationsByRestaurantService as jest.Mock
      ).mockRejectedValue(new Error("DB error"));

      await getReservationsByRestaurant(
        mockReq({ params: { restaurantId: "r-1" } }),
        mockRes(),
      );

      expect(response.sendError).toHaveBeenCalledWith(
        expect.anything(),
        "DB error",
        500,
      );
    });
  });

  // cancelReservation
  describe("DELETE /reservations/:id", () => {
    it("cancela la reserva si existe", async () => {
      const cancelled = { id: "res-1", status: "cancelled" };
      (
        reservationService.cancelReservationService as jest.Mock
      ).mockResolvedValue(cancelled);

      await cancelReservation(mockReq({ params: { id: "res-1" } }), mockRes());

      expect(reservationService.cancelReservationService).toHaveBeenCalledWith(
        "res-1",
        "user-1",
      );
      expect(response.sendSuccess).toHaveBeenCalledWith(
        expect.anything(),
        cancelled,
        "Reserva cancelada exitosamente",
      );
    });

    it("responde 404 si la reserva no existe o no se puede cancelar", async () => {
      (
        reservationService.cancelReservationService as jest.Mock
      ).mockResolvedValue(null);

      await cancelReservation(mockReq({ params: { id: "99" } }), mockRes());

      expect(response.sendError).toHaveBeenCalledWith(
        expect.anything(),
        "Reserva no encontrada o no se puede cancelar",
        404,
      );
    });

    it("responde 500 ante error inesperado", async () => {
      (
        reservationService.cancelReservationService as jest.Mock
      ).mockRejectedValue(new Error("DB error"));

      await cancelReservation(mockReq({ params: { id: "res-1" } }), mockRes());

      expect(response.sendError).toHaveBeenCalledWith(
        expect.anything(),
        "DB error",
        500,
      );
    });
  });
});
