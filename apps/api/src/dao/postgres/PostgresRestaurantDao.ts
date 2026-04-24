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

// el sp del listado incluye join con users para traer nombre/email del admin
// por eso tiene mapper propio en vez de reutilizar mapRestaurant
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
