import { Response } from "express";
import { AuthenticatedRequest } from "../middlewares/auth.middleware";
import { getMe, update, remove } from "../controllers/user.controller";
import * as userService from "../services/user.service";
import * as response from "../utils/response";

jest.mock("../services/user.service");
jest.mock("../utils/response");

const mockRes = () => ({}) as Response;
const mockReq = (opts: Partial<AuthenticatedRequest> = {}) =>
  ({
    body: {},
    params: {},
    user: { sub: "user-1" },
    ...opts,
  }) as AuthenticatedRequest;

describe("User Controller", () => {
  beforeEach(() => jest.clearAllMocks());

  // getMe
  describe("GET /users/me", () => {
    it("retorna el perfil del usuario autenticado", async () => {
      const fakeUser = { id: "u-1", email: "a@b.com" };
      (userService.getUserByExternalId as jest.Mock).mockResolvedValue(
        fakeUser,
      );

      await getMe(mockReq(), mockRes());

      expect(userService.getUserByExternalId).toHaveBeenCalledWith("user-1");
      expect(response.sendSuccess).toHaveBeenCalledWith(
        expect.anything(),
        fakeUser,
        "user profile retrieved",
      );
    });

    it("responde 404 si el usuario no existe", async () => {
      (userService.getUserByExternalId as jest.Mock).mockRejectedValue(
        new Error("user not found"),
      );

      await getMe(mockReq(), mockRes());

      expect(response.sendError).toHaveBeenCalledWith(
        expect.anything(),
        "user not found",
        404,
      );
    });
  });

  // update
  describe("PUT /users/:id", () => {
    it("actualiza el usuario exitosamente", async () => {
      const updated = { id: "u-1", email: "new@b.com" };
      (userService.updateUser as jest.Mock).mockResolvedValue(updated);

      await update(
        mockReq({ params: { id: "u-1" }, body: { email: "new@b.com" } }),
        mockRes(),
      );

      expect(userService.updateUser).toHaveBeenCalledWith("u-1", "user-1", {
        email: "new@b.com",
      });
      expect(response.sendSuccess).toHaveBeenCalledWith(
        expect.anything(),
        updated,
        "user updated successfully",
      );
    });

    it("responde 403 si el usuario no tiene permisos", async () => {
      (userService.updateUser as jest.Mock).mockRejectedValue(
        new Error("forbidden: cannot update another user"),
      );

      await update(mockReq({ params: { id: "u-99" } }), mockRes());

      expect(response.sendError).toHaveBeenCalledWith(
        expect.anything(),
        "forbidden: cannot update another user",
        403,
      );
    });

    it("responde 404 si el usuario no existe", async () => {
      (userService.updateUser as jest.Mock).mockRejectedValue(
        new Error("user not found"),
      );

      await update(mockReq({ params: { id: "u-99" } }), mockRes());

      expect(response.sendError).toHaveBeenCalledWith(
        expect.anything(),
        "user not found",
        404,
      );
    });
  });

  // remove
  describe("DELETE /users/:id", () => {
    it("elimina (soft delete) el usuario exitosamente", async () => {
      (userService.softDeleteUser as jest.Mock).mockResolvedValue(undefined);

      await remove(mockReq({ params: { id: "u-1" } }), mockRes());

      expect(userService.softDeleteUser).toHaveBeenCalledWith("u-1", "user-1");
      expect(response.sendSuccess).toHaveBeenCalledWith(
        expect.anything(),
        null,
        "user deleted successfully",
      );
    });

    it("responde 403 si el usuario no tiene permisos", async () => {
      (userService.softDeleteUser as jest.Mock).mockRejectedValue(
        new Error("forbidden: cannot delete another user"),
      );

      await remove(mockReq({ params: { id: "u-99" } }), mockRes());

      expect(response.sendError).toHaveBeenCalledWith(
        expect.anything(),
        "forbidden: cannot delete another user",
        403,
      );
    });

    it("responde 404 si el usuario no existe", async () => {
      (userService.softDeleteUser as jest.Mock).mockRejectedValue(
        new Error("user not found"),
      );

      await remove(mockReq({ params: { id: "u-99" } }), mockRes());

      expect(response.sendError).toHaveBeenCalledWith(
        expect.anything(),
        "user not found",
        404,
      );
    });
  });
});
