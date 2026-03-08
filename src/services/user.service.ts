import pool from '../config/database';
import { UpdateUserInput } from '../schemas/user.schema';

// obtiene el usuario local por su external_auth_id (sub del jwt de keycloak)
export async function getUserByExternalId(externalAuthId: string) {
  const result = await pool.query(
    'SELECT * FROM sp_get_user_by_external_id($1)',
    [externalAuthId]
  );

  if (result.rows.length === 0) {
    throw new Error('user not found');
  }

  const user = result.rows[0];
  return {
    id: user.id,
    fullName: user.full_name,
    email: user.email,
    role: user.role,
    phone: user.phone,
    createdAt: user.created_at,
    updatedAt: user.updated_at,
  };
}

// actualiza el perfil del usuario - solo permite modificar el propio
export async function updateUser(userId: string, externalAuthId: string, input: UpdateUserInput) {
  // verificar que el usuario existe y le pertenece
  const existing = await pool.query(
    'SELECT * FROM sp_get_user_by_id($1)',
    [userId]
  );

  if (existing.rows.length === 0) {
    throw new Error('user not found');
  }

  // verificar que el usuario autenticado es el dueño del recurso
  if (existing.rows[0].external_auth_id !== externalAuthId) {
    throw new Error('forbidden: you can only update your own profile');
  }

  const result = await pool.query(
    'SELECT * FROM sp_update_user($1, $2, $3)',
    [userId, input.fullName || null, input.phone || null]
  );

  const user = result.rows[0];
  return {
    id: user.id,
    fullName: user.full_name,
    email: user.email,
    role: user.role,
    phone: user.phone,
    updatedAt: user.updated_at,
  };
}

// soft delete del usuario - solo permite eliminar el propio
export async function softDeleteUser(userId: string, externalAuthId: string) {
  const existing = await pool.query(
    'SELECT * FROM sp_get_user_by_id($1)',
    [userId]
  );

  if (existing.rows.length === 0) {
    throw new Error('user not found');
  }

  // verificar que el usuario autenticado es el dueño del recurso
  if (existing.rows[0].external_auth_id !== externalAuthId) {
    throw new Error('forbidden: you can only delete your own account');
  }

  await pool.query('SELECT sp_soft_delete_user($1)', [userId]);
}
