import { Request, Response, NextFunction } from "express";
import { cacheMiddleware, invalidateCache } from "../middlewares/cache.middleware";
import * as redisConfig from "../config/redis";

jest.mock("../config/redis");

const makeRedisClient = (overrides: Partial<ReturnType<typeof buildMockClient>> = {}) => {
  return buildMockClient(overrides);
};

function buildMockClient(overrides: Record<string, any> = {}) {
  return {
    get: jest.fn().mockResolvedValue(null),
    setEx: jest.fn().mockResolvedValue(undefined),
    keys: jest.fn().mockResolvedValue([]),
    del: jest.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

const mockReq = (url = "/api/restaurants") =>
  ({ originalUrl: url }) as Request;

const mockRes = () => {
  const res: Partial<Response> = {
    setHeader: jest.fn(),
    statusCode: 200,
  };
  res.json = jest.fn().mockReturnValue(res);
  return res as Response;
};

const mockNext: NextFunction = jest.fn();

describe("cache.middleware", () => {
  beforeEach(() => jest.clearAllMocks());

  // ── cacheMiddleware ──────────────────────────────────────────────────────────

  describe("cacheMiddleware", () => {
    it("llama next() directamente si Redis no esta disponible", async () => {
      (redisConfig.getRedisClient as jest.Mock).mockReturnValue(null);

      const middleware = cacheMiddleware(60);
      await middleware(mockReq(), mockRes(), mockNext);

      expect(mockNext).toHaveBeenCalled();
    });

    it("devuelve respuesta cacheada y establece X-Cache: HIT", async () => {
      const cached = JSON.stringify({ success: true, data: [{ id: "r1" }] });
      const client = makeRedisClient({ get: jest.fn().mockResolvedValue(cached) });
      (redisConfig.getRedisClient as jest.Mock).mockReturnValue(client);

      const req = mockReq();
      const res = mockRes();

      const middleware = cacheMiddleware(60);
      await middleware(req, res, mockNext);

      expect(res.setHeader).toHaveBeenCalledWith("X-Cache", "HIT");
      expect(res.json).toHaveBeenCalledWith(JSON.parse(cached));
      expect(mockNext).not.toHaveBeenCalled();
    });

    it("llama next() y cachea la respuesta cuando no hay hit (MISS)", async () => {
      const client = makeRedisClient({ get: jest.fn().mockResolvedValue(null) });
      (redisConfig.getRedisClient as jest.Mock).mockReturnValue(client);

      const req = mockReq();
      const res = mockRes();

      const middleware = cacheMiddleware(120);
      await middleware(req, res, mockNext);

      // next fue llamado
      expect(mockNext).toHaveBeenCalled();

      // interceptar res.json y verificar que cachea
      const body = { success: true, data: [] };
      res.json(body);

      expect(client.setEx).toHaveBeenCalledWith(
        `cache:${req.originalUrl}`,
        120,
        JSON.stringify(body),
      );
      expect(res.setHeader).toHaveBeenCalledWith("X-Cache", "MISS");
    });

    it("no cachea respuestas de error (status >= 400)", async () => {
      const client = makeRedisClient({ get: jest.fn().mockResolvedValue(null) });
      (redisConfig.getRedisClient as jest.Mock).mockReturnValue(client);

      const res = mockRes();
      (res as any).statusCode = 404;

      const middleware = cacheMiddleware(60);
      await middleware(mockReq(), res, mockNext);

      res.json({ success: false });

      expect(client.setEx).not.toHaveBeenCalled();
    });

    it("llama next() si Redis lanza error al consultar", async () => {
      const client = makeRedisClient({
        get: jest.fn().mockRejectedValue(new Error("connection refused")),
      });
      (redisConfig.getRedisClient as jest.Mock).mockReturnValue(client);

      const middleware = cacheMiddleware(60);
      await middleware(mockReq(), mockRes(), mockNext);

      expect(mockNext).toHaveBeenCalled();
    });
  });

  // ── invalidateCache ──────────────────────────────────────────────────────────

  describe("invalidateCache", () => {
    it("no hace nada si Redis no esta disponible", async () => {
      (redisConfig.getRedisClient as jest.Mock).mockReturnValue(null);
      await expect(invalidateCache("cache:/api/restaurants")).resolves.toBeUndefined();
    });

    it("elimina las claves que coinciden con el patron", async () => {
      const client = makeRedisClient({
        keys: jest.fn().mockResolvedValue(["cache:/api/restaurants"]),
      });
      (redisConfig.getRedisClient as jest.Mock).mockReturnValue(client);

      await invalidateCache("cache:/api/restaurants");

      expect(client.keys).toHaveBeenCalledWith("cache:/api/restaurants");
      expect(client.del).toHaveBeenCalledWith(["cache:/api/restaurants"]);
    });

    it("no llama del si no hay claves que coincidan", async () => {
      const client = makeRedisClient({ keys: jest.fn().mockResolvedValue([]) });
      (redisConfig.getRedisClient as jest.Mock).mockReturnValue(client);

      await invalidateCache("cache:/api/menus/*");

      expect(client.del).not.toHaveBeenCalled();
    });

    it("acepta multiples patrones en una sola llamada", async () => {
      const client = makeRedisClient({
        keys: jest
          .fn()
          .mockResolvedValueOnce(["cache:/api/menus/1"])
          .mockResolvedValueOnce(["cache:/api/menus/restaurant/r1"]),
      });
      (redisConfig.getRedisClient as jest.Mock).mockReturnValue(client);

      await invalidateCache("cache:/api/menus/1", "cache:/api/menus/restaurant/*");

      expect(client.keys).toHaveBeenCalledTimes(2);
      expect(client.del).toHaveBeenCalledTimes(2);
    });

    it("continua con los siguientes patrones si uno falla", async () => {
      const client = makeRedisClient({
        keys: jest
          .fn()
          .mockRejectedValueOnce(new Error("timeout"))
          .mockResolvedValueOnce(["cache:/api/restaurants"]),
        del: jest.fn().mockResolvedValue(undefined),
      });
      (redisConfig.getRedisClient as jest.Mock).mockReturnValue(client);

      await expect(
        invalidateCache("cache:/bad-pattern", "cache:/api/restaurants"),
      ).resolves.toBeUndefined();
    });
  });
});
