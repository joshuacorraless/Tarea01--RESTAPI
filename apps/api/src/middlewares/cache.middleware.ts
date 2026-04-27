import { Request, Response, NextFunction } from 'express';
import { getRedisClient } from '../config/redis';

/**
 * Middleware Cache-Aside: consulta Redis antes de llegar al controlador.
 * Si hay hit devuelve la respuesta cacheada; si hay miss intercepta res.json
 * para guardar la respuesta fresca en Redis con el TTL indicado.
 */
export function cacheMiddleware(ttlSeconds: number) {
  return async (req: Request, res: Response, next: NextFunction) => {
    const redis = getRedisClient();
    if (!redis) return next(); // Redis no disponible → continuar sin cache

    const key = `cache:${req.originalUrl}`;

    try {
      const cached = await redis.get(key);
      if (cached) {
        res.setHeader('X-Cache', 'HIT');
        return res.json(JSON.parse(cached));
      }
    } catch {
      return next(); // error de Redis → servir sin cache, no romper el request
    }

    // interceptar res.json para cachear la respuesta antes de enviarla
    const originalJson = res.json.bind(res);
    res.json = (body) => {
      // solo cachear respuestas exitosas (2xx)
      if (res.statusCode < 400) {
        redis.setEx(key, ttlSeconds, JSON.stringify(body)).catch(() => {});
      }
      res.setHeader('X-Cache', 'MISS');
      return originalJson(body);
    };

    next();
  };
}

/**
 * Elimina claves de Redis que coincidan con los patrones dados.
 * Acepta wildcards de Redis: ej. "cache:/api/menus/restaurant/*"
 * Llamar despues de cualquier operacion de escritura (POST, PUT, DELETE).
 */
export async function invalidateCache(...patterns: string[]): Promise<void> {
  const redis = getRedisClient();
  if (!redis) return;

  for (const pattern of patterns) {
    try {
      const keys = await redis.keys(pattern);
      if (keys.length > 0) await redis.del(keys);
    } catch {
      // fallo silencioso — la invalidacion no es critica para el flujo principal
    }
  }
}
