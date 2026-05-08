import { Request, Response, NextFunction } from 'express';
import { getRedisClient } from '../config/redis';

// cache-aside: si hay hit devuelve lo cacheado; si hay miss guarda la respuesta fresca con el ttl dado
export function cacheMiddleware(ttlSeconds: number) {
  return async (req: Request, res: Response, next: NextFunction) => {
    const redis = getRedisClient();
    if (!redis) return next();

    const key = `cache:${req.originalUrl}`;

    try {
      const cached = await redis.get(key);
      if (cached) {
        res.setHeader('X-Cache', 'HIT');
        return res.json(JSON.parse(cached));
      }
    } catch {
      // si redis falla seguimos sin cache, no rompemos el request
      return next();
    }

    const originalJson = res.json.bind(res);
    res.json = (body) => {
      if (res.statusCode < 400) {
        redis.setEx(key, ttlSeconds, JSON.stringify(body)).catch(() => {});
      }
      res.setHeader('X-Cache', 'MISS');
      return originalJson(body);
    };

    next();
  };
}

// se llama despues de cualquier escritura para que el cache no quede desactualizado
export async function invalidateCache(...patterns: string[]): Promise<void> {
  const redis = getRedisClient();
  if (!redis) return;

  for (const pattern of patterns) {
    try {
      const keys = await redis.keys(pattern);
      if (keys.length > 0) await redis.del(keys);
    } catch {
      // si falla la invalidacion no rompemos el flujo principal
    }
  }
}
