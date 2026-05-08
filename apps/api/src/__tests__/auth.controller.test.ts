import { Request, Response } from "express";
import { register, login } from "../controllers/auth.controller";
import * as authService from "../services/auth.service";
import * as response from "../utils/response";

// Mock de servicios y utilidades
jest.mock("../services/auth.service");
jest.mock("../utils/response");

const mockReq = (body = {}) => ({ body }) as Request;
const mockRes = () => ({}) as Response;

describe("Auth Controller", () => {
  beforeEach(() => jest.clearAllMocks());

  // register
  describe("POST /auth/register", () => {
    it("registra un usuario y responde 201", async () => {
      const fakeUser = { id: "1", email: "a@b.com" };
      (authService.registerUser as jest.Mock).mockResolvedValue(fakeUser);

      const req = mockReq({ email: "a@b.com", password: "1234" });
      const res = mockRes();

      await register(req, res);

      expect(authService.registerUser).toHaveBeenCalledWith(req.body);
      expect(response.sendSuccess).toHaveBeenCalledWith(
        res,
        fakeUser,
        "user registered successfully",
        201,
      );
    });

    it("responde 409 si el usuario ya existe (Keycloak)", async () => {
      const error = { response: { status: 409 } };
      (authService.registerUser as jest.Mock).mockRejectedValue(error);

      await register(mockReq(), mockRes());

      expect(response.sendError).toHaveBeenCalledWith(
        expect.anything(),
        "user with this email already exists",
        409,
      );
    });

    it("responde 500 ante error inesperado", async () => {
      (authService.registerUser as jest.Mock).mockRejectedValue(
        new Error("DB exploded"),
      );

      await register(mockReq(), mockRes());

      expect(response.sendError).toHaveBeenCalledWith(
        expect.anything(),
        "DB exploded",
        500,
      );
    });

    it("responde 500 con mensaje por defecto si el error no tiene message", async () => {
      (authService.registerUser as jest.Mock).mockRejectedValue({});

      await register(mockReq(), mockRes());

      expect(response.sendError).toHaveBeenCalledWith(
        expect.anything(),
        "registration failed",
        500,
      );
    });
  });

  // login
  describe("POST /auth/login", () => {
    it("hace login y devuelve tokens", async () => {
      const fakeTokens = { access_token: "jwt-abc", refresh_token: "ref-xyz" };
      (authService.loginUser as jest.Mock).mockResolvedValue(fakeTokens);

      const req = mockReq({ email: "a@b.com", password: "1234" });
      const res = mockRes();

      await login(req, res);

      expect(authService.loginUser).toHaveBeenCalledWith(req.body);
      expect(response.sendSuccess).toHaveBeenCalledWith(
        res,
        fakeTokens,
        "login successful",
      );
    });

    it("responde 401 si las credenciales son inválidas (Keycloak)", async () => {
      const error = { response: { status: 401 } };
      (authService.loginUser as jest.Mock).mockRejectedValue(error);

      await login(mockReq(), mockRes());

      expect(response.sendError).toHaveBeenCalledWith(
        expect.anything(),
        "invalid email or password",
        401,
      );
    });

    it("responde 500 ante error inesperado", async () => {
      (authService.loginUser as jest.Mock).mockRejectedValue(
        new Error("timeout"),
      );

      await login(mockReq(), mockRes());

      expect(response.sendError).toHaveBeenCalledWith(
        expect.anything(),
        "timeout",
        500,
      );
    });

    it("responde 500 con mensaje por defecto si el error no tiene message", async () => {
      (authService.loginUser as jest.Mock).mockRejectedValue({});

      await login(mockReq(), mockRes());

      expect(response.sendError).toHaveBeenCalledWith(
        expect.anything(),
        "login failed",
        500,
      );
    });
  });
});
