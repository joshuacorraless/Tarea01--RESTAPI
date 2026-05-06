import pool from "../../config/database";
import {
  CreateMenuItemInput,
  UpdateMenuItemInput,
} from "../../schemas/menu-reservation-order.schema";
import { IMenuItemDao, MenuItemRecord } from "../interfaces/IMenuItemDao";

function mapMenuItem(row: any): MenuItemRecord {
  return {
    id: row.id,
    idMenu: row.idmenu,
    restaurantId: row.restaurantid,
    nombre: row.nombre,
    detalles: row.detalles,
    categoria: row.categoria,
    // pg devuelve NUMERIC como string, lo casteamos a number
    precio: Number(row.precio),
    imagen: row.imagen,
    disponible: row.disponible,
    creadoEn: row.creadoen,
    ultimaActualizacion: row.ultimaactualizacion,
  };
}

export class PostgresMenuItemDao implements IMenuItemDao {
  async create(
    menuId: string,
    input: CreateMenuItemInput,
  ): Promise<MenuItemRecord> {
    const result = await pool.query(
      "SELECT * FROM sp_create_menu_item($1, $2, $3, $4, $5, $6, $7)",
      [
        menuId,
        input.nombre,
        input.detalles,
        input.precio,
        input.imagen || null,
        input.disponible ?? true,
        input.categoria ?? "General",
      ],
    );
    return mapMenuItem(result.rows[0]);
  }

  async getByMenu(menuId: string): Promise<MenuItemRecord[]> {
    const result = await pool.query("SELECT * FROM sp_get_menu_items($1)", [
      menuId,
    ]);
    return result.rows.map(mapMenuItem);
  }

  async findAll(): Promise<MenuItemRecord[]> {
    const result = await pool.query("SELECT * FROM sp_get_all_menu_items()");
    return result.rows.map(mapMenuItem);
  }

  async update(
    _menuId: string,
    itemId: string,
    input: UpdateMenuItemInput,
  ): Promise<MenuItemRecord | null> {
    const result = await pool.query(
      "SELECT * FROM sp_update_menu_item($1, $2, $3, $4, $5, $6, $7)",
      [
        itemId,
        input.nombre || null,
        input.detalles || null,
        input.precio ?? null,
        input.imagen || null,
        input.disponible ?? null,
        input.categoria ?? null,
      ],
    );
    if (result.rows.length === 0) return null;
    return mapMenuItem(result.rows[0]);
  }

  async softDelete(_menuId: string, itemId: string): Promise<void> {
    await pool.query("SELECT sp_delete_menu_item($1)", [itemId]);
  }
}
