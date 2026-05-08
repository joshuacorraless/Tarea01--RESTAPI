import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

const envSchema = z.object({
  PORT: z.string().default('3000'),
  DATABASE_URL: z.string(),
  KEYCLOAK_BASE_URL: z.string(),
  KEYCLOAK_REALM: z.string().min(1),
  KEYCLOAK_CLIENT_ID: z.string().min(1),
  KEYCLOAK_CLIENT_SECRET: z.string().min(1),
  KEYCLOAK_ADMIN_CLIENT_ID: z.string().min(1),
  KEYCLOAK_ADMIN_CLIENT_SECRET: z.string().min(1),
  // bootstrap del master realm para no depender del service account en dev
  KEYCLOAK_MASTER_ADMIN_USERNAME: z.string().optional(),
  KEYCLOAK_MASTER_ADMIN_PASSWORD: z.string().optional(),
  DB_ENGINE: z.enum(['postgres', 'mongo']).default('postgres'),
  MONGODB_URI: z.string().optional(),
  MONGO_REPLICA_SET: z.string().optional(),
  // si no esta definida el cache queda apagado
  REDIS_URL: z.string().optional(),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('variables de entorno invalidas:', parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const env = parsed.data;
