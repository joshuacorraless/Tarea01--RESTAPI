import pool from '../config/database';
import { CreateRestaurantInput } from '../schemas/restaurant.schema';

// crea un restaurante vinculado al admin autenticado
export async function createRestaurant(adminExternalId: string, input: CreateRestaurantInput) {
  // buscar el usuario local por su external_auth_id
  const adminResult = await pool.query(
    'SELECT * FROM sp_get_user_by_external_id($1)',
    [adminExternalId]
  );

  if (adminResult.rows.length === 0) {
    throw new Error('admin user not found');
  }

  const adminUser = adminResult.rows[0];

  const result = await pool.query(
    'SELECT * FROM sp_create_restaurant($1, $2, $3, $4, $5, $6)',
    [
      input.name,
      input.description || null,
      input.address,
      input.phone || null,
      input.openingHours || null,
      adminUser.id,
    ]
  );

  const restaurant = result.rows[0];
  return {
    id: restaurant.id,
    name: restaurant.name,
    description: restaurant.description,
    address: restaurant.address,
    phone: restaurant.phone,
    openingHours: restaurant.opening_hours,
    adminUserId: restaurant.admin_user_id,
    createdAt: restaurant.created_at,
  };
}

// lista todos los restaurantes activos (no eliminados) con info del admin
export async function listRestaurants() {
  const result = await pool.query('SELECT * FROM sp_list_restaurants()');

  return result.rows.map((row) => ({
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
  }));
}
