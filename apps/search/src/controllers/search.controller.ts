import { Request, Response } from 'express';
import * as SearchService from '../services/search.service';
import { env } from '../config/env';

export async function searchByText(req: Request, res: Response) {
  const q = req.query.q as string;

  if (!q || q.trim() === '') {
    return res.status(400).json({ error: 'El parámetro q es requerido' });
  }

  const results = await SearchService.searchByText(q.trim());
  return res.json({ results, total: results.length });
}

export async function searchByCategory(req: Request, res: Response) {
  const { categoria } = req.params as { categoria: string };
  const results = await SearchService.searchByCategory(categoria);
  return res.json({ results, total: results.length });
}

export async function reindex(req: Request, res: Response) {
  // Pedirle a la API principal todos los ítems de menú
  const response = await fetch(`${env.API_INTERNAL_URL}/api/menus/items/all`);

  if (!response.ok) {
    return res.status(502).json({ error: 'No se pudo obtener los productos de la API' });
  }

  const data = await response.json() as { success: boolean, data: any[] };

  // Mapear los campos de la BD al formato del documento ES
  const products = data.data.map(item => ({
    id: item.id,
    restaurantId: item.restaurantId, // viene del JOIN que hace la API
    menuId: item.idMenu,
    nombre: item.nombre,
    categoria: item.categoria || 'General',
    descripcion: item.detalles || 'Producto sin descripción', // detalles → descripcion
    precio: Number(item.precio),
    disponible: item.disponible ?? true,
  }));

  const result = await SearchService.reindex(products);
  return res.json({ message: 'Reindex completado', ...result });
}