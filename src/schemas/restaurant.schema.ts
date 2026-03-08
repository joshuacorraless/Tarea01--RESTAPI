import { z } from 'zod';

export const createRestaurantSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().max(1000).optional(),
  address: z.string().min(1).max(500),
  phone: z.string().optional(),
  openingHours: z.string().max(200).optional(),
});

export type CreateRestaurantInput = z.infer<typeof createRestaurantSchema>;
