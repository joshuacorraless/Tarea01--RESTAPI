import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

// schema de validacion para variables de entorno requeridas
const envSchema = z.object({
  PORT: z.string().default('3000'),
  DATABASE_URL: z.string(),
  KEYCLOAK_BASE_URL: z.string(),
  KEYCLOAK_REALM: z.string().min(1),
  KEYCLOAK_CLIENT_ID: z.string().min(1),
  KEYCLOAK_CLIENT_SECRET: z.string().min(1),
  KEYCLOAK_ADMIN_CLIENT_ID: z.string().min(1),
  KEYCLOAK_ADMIN_CLIENT_SECRET: z.string().min(1),
  DB_ENGINE: z.enum(['postgres', 'mongo']).default('postgres'),
  // requerida cuando DB_ENGINE=mongo; ignorada en postgres
  MONGODB_URI: z.string().optional(),
  // nombre del replica set; vacio para standalone (desarrollo local sin replica)
  MONGO_REPLICA_SET: z.string().optional(),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('variables de entorno invalidas:', parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const env = parsed.data;
