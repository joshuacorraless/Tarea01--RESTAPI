import { Request, Response } from "express";
import { AuthenticatedRequest } from "../middlewares/auth.middleware";
import { create, list } from "../controllers/restaurant.controller";
import * as restaurantService from "../services/restaurant.service";
import * as response from "../utils/response";

jest.mock("../services/restaurant.service");
jest.mock("../utils/response");

const mockRes = () => ({}) as Response;
const mockReq = (opts: Partial<AuthenticatedRequest> = {}) =>
  ({
    body: {},
    params: {},
    user: { sub: "admin-1" },
    ...opts,
  }) as AuthenticatedRequest;

describe("Restaurant Controller", () => {
  beforeEach(() => jest.clearAllMocks());

  // create
  describe("POST /restaurants", () => {
    it("crea un restaurante con el sub del admin como owner", async () => {
      const fakeRestaurant = { id: "r-1", name: "La Trattoria" };
      (restaurantService.createRestaurant as jest.Mock).mockResolvedValue(
        fakeRestaurant,
      );

      await create(mockReq({ body: { name: "La Trattoria" } }), mockRes());

      expect(restaurantService.createRestaurant).toHaveBeenCalledWith(
        "admin-1",
        { name: "La Trattoria" },
      );
      expect(response.sendSuccess).toHaveBeenCalledWith(
        expect.anything(),
        fakeRestaurant,
        "restaurant created successfully",
        201,
      );
    });

    it("responde 500 ante error inesperado", async () => {
      (restaurantService.createRestaurant as jest.Mock).mockRejectedValue(
        new Error("DB error"),
      );

      await create(mockReq(), mockRes());

      expect(response.sendError).toHaveBeenCalledWith(
        expect.anything(),
        "DB error",
        500,
      );
    });
  });

  // list
  describe("GET /restaurants", () => {
    it("retorna la lista de restaurantes disponibles", async () => {
      const fakeList = [{ id: "r-1" }, { id: "r-2" }];
      (restaurantService.listRestaurants as jest.Mock).mockResolvedValue(
        fakeList,
      );

      await list({} as Request, mockRes());

      expect(restaurantService.listRestaurants).toHaveBeenCalled();
      expect(response.sendSuccess).toHaveBeenCalledWith(
        expect.anything(),
        fakeList,
        "restaurants retrieved",
      );
    });

    it("retorna lista vacía si no hay restaurantes", async () => {
      (restaurantService.listRestaurants as jest.Mock).mockResolvedValue([]);

      await list({} as Request, mockRes());

      expect(response.sendSuccess).toHaveBeenCalledWith(
        expect.anything(),
        [],
        "restaurants retrieved",
      );
    });

    it("responde 500 ante error inesperado", async () => {
      (restaurantService.listRestaurants as jest.Mock).mockRejectedValue(
        new Error("DB error"),
      );

      await list({} as Request, mockRes());

      expect(response.sendError).toHaveBeenCalledWith(
        expect.anything(),
        "DB error",
        500,
      );
    });
  });
});
