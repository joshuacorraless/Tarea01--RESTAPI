import pool from '../../config/database';
import {
  CreateMenuInput,
  UpdateMenuInput,
} from '../../schemas/menu-reservation-order.schema';
import { IMenuDao, MenuRecord } from '../interfaces/IMenuDao';

function mapMenu(row: any): MenuRecord {
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

export class PostgresMenuDao implements IMenuDao {
  async create(input: CreateMenuInput): Promise<MenuRecord> {
    const result = await pool.query(
      'SELECT * FROM sp_create_menu($1, $2, $3, $4)',
      [input.idRestaurante, input.nombre, input.detalles, input.activo ?? true],
    );
    return mapMenu(result.rows[0]);
  }

  async getById(id: string): Promise<MenuRecord | null> {
    const result = await pool.query('SELECT * FROM sp_get_menu_by_id($1)', [id]);
    if (result.rows.length === 0) return null;
    return mapMenu(result.rows[0]);
  }

  async getByRestaurant(restaurantId: string): Promise<MenuRecord[]> {
    const result = await pool.query(
      'SELECT * FROM sp_get_menus_by_restaurant($1)',
      [restaurantId],
    );
    return result.rows.map(mapMenu);
  }

  async update(id: string, input: UpdateMenuInput): Promise<MenuRecord | null> {
    const result = await pool.query(
      'SELECT * FROM sp_update_menu($1, $2, $3, $4)',
      [id, input.nombre || null, input.detalles || null, input.activo ?? null],
    );
    if (result.rows.length === 0) return null;
    return mapMenu(result.rows[0]);
  }

  async softDelete(id: string): Promise<void> {
    await pool.query('SELECT sp_delete_menu($1)', [id]);
  }
}
