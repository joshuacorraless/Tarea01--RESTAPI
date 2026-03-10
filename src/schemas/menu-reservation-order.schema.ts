import { z } from "zod";

// menu
export const createMenuSchema = z.object({
  idRestaurante: z.string().uuid(),
  nombre: z.string().min(1).max(200),
  detalles: z.string().min(1).max(1000),
  activo: z.boolean().optional().default(true),
});

export const updateMenuSchema = z.object({
  nombre: z.string().min(1).max(200).optional(),
  detalles: z.string().min(1).max(1000).optional(),
  activo: z.boolean().optional(),
});

export type CreateMenuInput = z.infer<typeof createMenuSchema>;
export type UpdateMenuInput = z.infer<typeof updateMenuSchema>;

// menu item
export const createMenuItemSchema = z.object({
  nombre: z.string().min(1).max(200),
  detalles: z.string().min(1).max(1000),
  precio: z.number().nonnegative(),
  imagen: z.string().url().max(500).optional(),
  disponible: z.boolean().optional().default(true),
});

export const updateMenuItemSchema = z.object({
  nombre: z.string().min(1).max(200).optional(),
  detalles: z.string().min(1).max(1000).optional(),
  precio: z.number().nonnegative().optional(),
  imagen: z.string().url().max(500).optional(),
  disponible: z.boolean().optional(),
});

export type CreateMenuItemInput = z.infer<typeof createMenuItemSchema>;
export type UpdateMenuItemInput = z.infer<typeof updateMenuItemSchema>;

// reservas
export const createReservationSchema = z.object({
  idRestaurante: z.string().uuid(),
  mesaId: z.string().uuid(),
  tamannoReserva: z.number().int().positive(),
  reservadoPara: z.string().datetime(),
  duracionReserva: z.number().int().positive().optional().default(90),
  notas: z.string().max(500).optional(),
});

export type CreateReservationInput = z.infer<typeof createReservationSchema>;

// pedidos
const orderItemSchema = z.object({
  idItemMenu: z.string().uuid(),
  cantidad: z.number().int().positive(),
  notas: z.string().max(300).optional(),
});

export const createOrderSchema = z.object({
  idRestaurante: z.string().uuid(),
  idReserva: z.string().uuid().optional(),
  tipoOrden: z
    .enum(["en-restaurante", "para-llevar"])
    .optional()
    .default("en-restaurante"),
  notas: z.string().max(500).optional(),
  items: z.array(orderItemSchema).min(1),
});

export const addOrderItemSchema = orderItemSchema;

export const updateOrderStatusSchema = z.object({
  status: z.enum([
    "pendiente",
    "confirmada",
    "en-preparacion",
    "lista",
    "entregada",
    "cancelada",
  ]),
});

export type CreateOrderInput = z.infer<typeof createOrderSchema>;
export type AddOrderItemInput = z.infer<typeof addOrderItemSchema>;
export type UpdateOrderStatusInput = z.infer<typeof updateOrderStatusSchema>;
