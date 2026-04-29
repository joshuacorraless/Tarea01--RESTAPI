import { z } from "zod";

const envSchema = z.object({
  PORT: z.string().default("3001"),
  ELASTICSEARCH_URL: z.string().default("http://localhost:9200"),
  API_INTERNAL_URL: z.string().default("http://localhost:3000"),
});

export const env = envSchema.parse(process.env);
