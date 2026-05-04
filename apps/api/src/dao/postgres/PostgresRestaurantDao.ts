import pool from '../../config/database';
import {
  CreateRestaurantData,
  IRestaurantDao,
  RestaurantRecord,
  RestaurantWithAdminRecord,
} from '../interfaces/IRestaurantDao';

function mapRestaurant(row: any): RestaurantRecord {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    address: row.address,
    phone: row.phone,
    openingHours: row.opening_hours,
    adminUserId: row.admin_user_id,
    createdAt: row.created_at,
  };
}

// mapper aparte porque el listado trae join con users (nombre/email del admin)
function mapRestaurantWithAdmin(row: any): RestaurantWithAdminRecord {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    address: row.address,
    phone: row.phone,
    openingHours: row.opening_hours,
    adminUserId: row.admin_user_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    adminUser: {
      fullName: row.admin_name,
      email: row.admin_email,
    },
  };
}

export class PostgresRestaurantDao implements IRestaurantDao {
  async create(data: CreateRestaurantData): Promise<RestaurantRecord> {
    const result = await pool.query(
      'SELECT * FROM sp_create_restaurant($1, $2, $3, $4, $5, $6)',
      [
        data.name,
        data.description || null,
        data.address,
        data.phone || null,
        data.openingHours || null,
        data.adminUserId,
      ],
    );
    return mapRestaurant(result.rows[0]);
  }

  async list(): Promise<RestaurantWithAdminRecord[]> {
    const result = await pool.query('SELECT * FROM sp_list_restaurants()');
    return result.rows.map(mapRestaurantWithAdmin);
  }
}
