import { Response } from "express";
import { AuthenticatedRequest } from "../middlewares/auth.middleware";
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
import * as menuService from "../services/menu.service";
import * as response from "../utils/response";

jest.mock("../services/menu.service");
jest.mock("../utils/response");

const mockRes = () => ({}) as Response;
const mockReq = (opts: Partial<AuthenticatedRequest> = {}) =>
  ({
    body: {},
    params: {},
    user: { sub: "user-1" },
    ...opts,
  }) as AuthenticatedRequest;

describe("Menu Controller", () => {
  beforeEach(() => jest.clearAllMocks());

  // ─── createMenu ────────────────────────────────────────────
  describe("POST /menus", () => {
    it("crea un menú y responde 201", async () => {
      const fakeMenu = { id: "1", name: "Menú del día" };
      (menuService.createMenuService as jest.Mock).mockResolvedValue(fakeMenu);

      await createMenu(mockReq({ body: { name: "Menú del día" } }), mockRes());

      expect(menuService.createMenuService).toHaveBeenCalledWith({
        name: "Menú del día",
      });
      expect(response.sendSuccess).toHaveBeenCalledWith(
        expect.anything(),
        fakeMenu,
        "menu creado exitosamente",
        201,
      );
    });

    it("responde 500 ante error inesperado", async () => {
      (menuService.createMenuService as jest.Mock).mockRejectedValue(
        new Error("DB error"),
      );

      await createMenu(mockReq(), mockRes());

      expect(response.sendError).toHaveBeenCalledWith(
        expect.anything(),
        "DB error",
        500,
      );
    });
  });

  // ─── getMenuById ───────────────────────────────────────────
  describe("GET /menus/:id", () => {
    it("retorna el menú si existe", async () => {
      const fakeMenu = { id: "1", name: "Menú del día" };
      (menuService.getMenuByIdService as jest.Mock).mockResolvedValue(fakeMenu);

      await getMenuById(mockReq({ params: { id: "1" } }), mockRes());

      expect(response.sendSuccess).toHaveBeenCalledWith(
        expect.anything(),
        fakeMenu,
        "menu encontrado",
      );
    });

    it("responde 404 si el menú no existe", async () => {
      (menuService.getMenuByIdService as jest.Mock).mockResolvedValue(null);

      await getMenuById(mockReq({ params: { id: "99" } }), mockRes());

      expect(response.sendError).toHaveBeenCalledWith(
        expect.anything(),
        "menu no encontrado",
        404,
      );
    });

    it("responde 500 ante error inesperado", async () => {
      (menuService.getMenuByIdService as jest.Mock).mockRejectedValue(
        new Error("DB error"),
      );

      await getMenuById(mockReq({ params: { id: "1" } }), mockRes());

      expect(response.sendError).toHaveBeenCalledWith(
        expect.anything(),
        "DB error",
        500,
      );
    });
  });

  // ─── getMenusByRestaurant ──────────────────────────────────
  describe("GET /restaurants/:restaurantId/menus", () => {
    it("retorna la lista de menús del restaurante", async () => {
      const fakeMenus = [{ id: "1" }, { id: "2" }];
      (menuService.getMenusByRestaurantService as jest.Mock).mockResolvedValue(
        fakeMenus,
      );

      await getMenusByRestaurant(
        mockReq({ params: { restaurantId: "r-1" } }),
        mockRes(),
      );

      expect(menuService.getMenusByRestaurantService).toHaveBeenCalledWith(
        "r-1",
      );
      expect(response.sendSuccess).toHaveBeenCalledWith(
        expect.anything(),
        fakeMenus,
        "menus encontrados",
      );
    });

    it("responde 500 ante error inesperado", async () => {
      (menuService.getMenusByRestaurantService as jest.Mock).mockRejectedValue(
        new Error("DB error"),
      );

      await getMenusByRestaurant(
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

  // ─── updateMenu ────────────────────────────────────────────
  describe("PUT /menus/:id", () => {
    it("actualiza el menú si existe", async () => {
      const updated = { id: "1", name: "Menú actualizado" };
      (menuService.updateMenuService as jest.Mock).mockResolvedValue(updated);

      await updateMenu(
        mockReq({ params: { id: "1" }, body: { name: "Menú actualizado" } }),
        mockRes(),
      );

      expect(response.sendSuccess).toHaveBeenCalledWith(
        expect.anything(),
        updated,
        "menu actualizado ",
      );
    });

    it("responde 404 si el menú no existe", async () => {
      (menuService.updateMenuService as jest.Mock).mockResolvedValue(null);

      await updateMenu(mockReq({ params: { id: "99" } }), mockRes());

      expect(response.sendError).toHaveBeenCalledWith(
        expect.anything(),
        "menu no encontrado",
        404,
      );
    });

    it("responde 500 ante error inesperado", async () => {
      (menuService.updateMenuService as jest.Mock).mockRejectedValue(
        new Error("DB error"),
      );

      await updateMenu(mockReq({ params: { id: "1" } }), mockRes());

      expect(response.sendError).toHaveBeenCalledWith(
        expect.anything(),
        "DB error",
        500,
      );
    });
  });

  // ─── deleteMenu ────────────────────────────────────────────
  describe("DELETE /menus/:id", () => {
    it("elimina el menú exitosamente", async () => {
      (menuService.deleteMenuService as jest.Mock).mockResolvedValue(undefined);

      await deleteMenu(mockReq({ params: { id: "1" } }), mockRes());

      expect(menuService.deleteMenuService).toHaveBeenCalledWith("1");
      expect(response.sendSuccess).toHaveBeenCalledWith(
        expect.anything(),
        null,
        "menu eliminado exitosamente",
      );
    });

    it("responde 500 ante error inesperado", async () => {
      (menuService.deleteMenuService as jest.Mock).mockRejectedValue(
        new Error("DB error"),
      );

      await deleteMenu(mockReq({ params: { id: "1" } }), mockRes());

      expect(response.sendError).toHaveBeenCalledWith(
        expect.anything(),
        "DB error",
        500,
      );
    });
  });

  // ─── createMenuItem ────────────────────────────────────────
  describe("POST /menus/:menuId/items", () => {
    it("crea un item y responde 201", async () => {
      const fakeItem = { id: "i-1", name: "Tacos" };
      (menuService.createMenuItemService as jest.Mock).mockResolvedValue(
        fakeItem,
      );

      await createMenuItem(
        mockReq({ params: { menuId: "m-1" }, body: { name: "Tacos" } }),
        mockRes(),
      );

      expect(menuService.createMenuItemService).toHaveBeenCalledWith("m-1", {
        name: "Tacos",
      });
      expect(response.sendSuccess).toHaveBeenCalledWith(
        expect.anything(),
        fakeItem,
        "item del menu creado exitosamente",
        201,
      );
    });

    it("responde 500 ante error inesperado", async () => {
      (menuService.createMenuItemService as jest.Mock).mockRejectedValue(
        new Error("DB error"),
      );

      await createMenuItem(mockReq({ params: { menuId: "m-1" } }), mockRes());

      expect(response.sendError).toHaveBeenCalledWith(
        expect.anything(),
        "DB error",
        500,
      );
    });
  });

  // ─── getMenuItems ──────────────────────────────────────────
  describe("GET /menus/:menuId/items", () => {
    it("retorna los items del menú", async () => {
      const fakeItems = [{ id: "i-1" }, { id: "i-2" }];
      (menuService.getMenuItemsService as jest.Mock).mockResolvedValue(
        fakeItems,
      );

      await getMenuItems(mockReq({ params: { menuId: "m-1" } }), mockRes());

      expect(menuService.getMenuItemsService).toHaveBeenCalledWith("m-1");
      expect(response.sendSuccess).toHaveBeenCalledWith(
        expect.anything(),
        fakeItems,
        "item del menu encontrado",
      );
    });

    it("responde 500 ante error inesperado", async () => {
      (menuService.getMenuItemsService as jest.Mock).mockRejectedValue(
        new Error("DB error"),
      );

      await getMenuItems(mockReq({ params: { menuId: "m-1" } }), mockRes());

      expect(response.sendError).toHaveBeenCalledWith(
        expect.anything(),
        "DB error",
        500,
      );
    });
  });

  // ─── updateMenuItem ────────────────────────────────────────
  describe("PUT /menus/items/:itemId", () => {
    it("actualiza el item si existe", async () => {
      const updated = { id: "i-1", name: "Tacos updated" };
      (menuService.updateMenuItemService as jest.Mock).mockResolvedValue(
        updated,
      );

      await updateMenuItem(
        mockReq({ params: { itemId: "i-1" }, body: { name: "Tacos updated" } }),
        mockRes(),
      );

      expect(response.sendSuccess).toHaveBeenCalledWith(
        expect.anything(),
        updated,
        "item del menu actualizado exitosamente",
      );
    });

    it("responde 404 si el item no existe", async () => {
      (menuService.updateMenuItemService as jest.Mock).mockResolvedValue(null);

      await updateMenuItem(mockReq({ params: { itemId: "99" } }), mockRes());

      expect(response.sendError).toHaveBeenCalledWith(
        expect.anything(),
        "item del menu no encontrado",
        404,
      );
    });

    it("responde 500 ante error inesperado", async () => {
      (menuService.updateMenuItemService as jest.Mock).mockRejectedValue(
        new Error("DB error"),
      );

      await updateMenuItem(mockReq({ params: { itemId: "i-1" } }), mockRes());

      expect(response.sendError).toHaveBeenCalledWith(
        expect.anything(),
        "DB error",
        500,
      );
    });
  });

  // ─── deleteMenuItem ────────────────────────────────────────
  describe("DELETE /menus/items/:itemId", () => {
    it("elimina el item exitosamente", async () => {
      (menuService.deleteMenuItemService as jest.Mock).mockResolvedValue(
        undefined,
      );

      await deleteMenuItem(mockReq({ params: { itemId: "i-1" } }), mockRes());

      expect(menuService.deleteMenuItemService).toHaveBeenCalledWith("i-1");
      expect(response.sendSuccess).toHaveBeenCalledWith(
        expect.anything(),
        null,
        "item del menu eliminado exitosamente",
      );
    });

    it("responde 500 ante error inesperado", async () => {
      (menuService.deleteMenuItemService as jest.Mock).mockRejectedValue(
        new Error("DB error"),
      );

      await deleteMenuItem(mockReq({ params: { itemId: "i-1" } }), mockRes());

      expect(response.sendError).toHaveBeenCalledWith(
        expect.anything(),
        "DB error",
        500,
      );
    });
  });
});
