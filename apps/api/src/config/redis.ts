import { createClient } from 'redis';
import { env } from './env';

type RedisClient = ReturnType<typeof createClient>;

let client: RedisClient | null = null;

export async function connectRedis(): Promise<void> {
  if (!env.REDIS_URL) {
    console.error('[Redis] REDIS_URL no definida — cache deshabilitada');
    return;
  }
  client = createClient({ url: env.REDIS_URL });
  client.on('error', (err) => console.error('[Redis] error de conexion:', err));
  await client.connect();
  console.warn('[Redis] conectado a', env.REDIS_URL);
}

export function getRedisClient(): RedisClient | null {
  return client;
}
