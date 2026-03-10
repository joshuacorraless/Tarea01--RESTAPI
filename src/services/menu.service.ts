import pool from '../config/database';
import { CreateMenuInput, UpdateMenuInput, CreateMenuItemInput, UpdateMenuItemInput } from '../schemas/menu-reservation-order.schema';

// helpers

function mapMenu(row: any) {
  return {
    id: row.id,
    idRestaurante: row.idrestaurante,
    nombre: row.nombre,
    detalles: row.detalles,
    activo: row.activo,
    creadoEn: row.creadoen,
    ultimaActualizacion: row.ultimaactualizacion,
  };
}

function mapMenuItem(row: any) {
  return {
    id: row.id,
    idMenu: row.idmenu,
    nombre: row.nombre,
    detalles: row.detalles,
    precio: Number(row.precio),
    imagen: row.imagen,
    disponible: row.disponible,
    creadoEn: row.creadoen,
    ultimaActualizacion: row.ultimaactualizacion,
  };
}

// menus

export async function createMenuService(input: CreateMenuInput) {
  const result = await pool.query(
    'SELECT * FROM sp_create_menu($1, $2, $3, $4)',
    [input.idRestaurante, input.nombre, input.detalles, input.activo ?? true],
  );
  return mapMenu(result.rows[0]);
}

export async function getMenuByIdService(id: string) {
  const result = await pool.query('SELECT * FROM sp_get_menu_by_id($1)', [id]);
  if (result.rows.length === 0) return null;
  return mapMenu(result.rows[0]);
}

export async function getMenusByRestaurantService(restaurantId: string) {
  const result = await pool.query('SELECT * FROM sp_get_menus_by_restaurant($1)', [restaurantId]);
  return result.rows.map(mapMenu);
}

export async function updateMenuService(id: string, input: UpdateMenuInput) {
  const result = await pool.query(
    'SELECT * FROM sp_update_menu($1, $2, $3, $4)',
    [id, input.nombre || null, input.detalles || null, input.activo ?? null],
  );
  if (result.rows.length === 0) return null;
  return mapMenu(result.rows[0]);
}

export async function deleteMenuService(id: string): Promise<void> {
  await pool.query('SELECT sp_delete_menu($1)', [id]);
}

// items del menu

export async function createMenuItemService(menuId: string, input: CreateMenuItemInput) {
  const result = await pool.query(
    'SELECT * FROM sp_create_menu_item($1, $2, $3, $4, $5, $6)',
    [menuId, input.nombre, input.detalles, input.precio, input.imagen || null, input.disponible ?? true],
  );
  return mapMenuItem(result.rows[0]);
}

export async function getMenuItemsService(menuId: string) {
  const result = await pool.query('SELECT * FROM sp_get_menu_items($1)', [menuId]);
  return result.rows.map(mapMenuItem);
}

export async function updateMenuItemService(itemId: string, input: UpdateMenuItemInput) {
  const result = await pool.query(
    'SELECT * FROM sp_update_menu_item($1, $2, $3, $4, $5, $6)',
    [itemId, input.nombre || null, input.detalles || null, input.precio ?? null, input.imagen || null, input.disponible ?? null],
  );
  if (result.rows.length === 0) return null;
  return mapMenuItem(result.rows[0]);
}

export async function deleteMenuItemService(itemId: string): Promise<void> {
  await pool.query('SELECT sp_delete_menu_item($1)', [itemId]);
}