import pool from '../../config/database';
import { UpdateUserInput } from '../../schemas/user.schema';
import {
  CreateUserData,
  IUserDao,
  UserRecord,
} from '../interfaces/IUserDao';

// los sp devuelven snake_case y los services trabajan en camelcase
function mapUser(row: any): UserRecord {
  return {
    id: row.id,
    fullName: row.full_name,
    email: row.email,
    externalAuthId: row.external_auth_id,
    role: row.role,
    phone: row.phone,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export class PostgresUserDao implements IUserDao {
  async create(data: CreateUserData): Promise<UserRecord> {
    const result = await pool.query(
      'SELECT * FROM sp_create_user($1, $2, $3, $4::user_role, $5)',
      [data.fullName, data.email, data.externalAuthId, data.role, data.phone || null],
    );
    return mapUser(result.rows[0]);
  }

  async getByExternalId(externalAuthId: string): Promise<UserRecord | null> {
    const result = await pool.query(
      'SELECT * FROM sp_get_user_by_external_id($1)',
      [externalAuthId],
    );
    if (result.rows.length === 0) return null;
    return mapUser(result.rows[0]);
  }

  async getById(id: string): Promise<UserRecord | null> {
    const result = await pool.query('SELECT * FROM sp_get_user_by_id($1)', [id]);
    if (result.rows.length === 0) return null;
    return mapUser(result.rows[0]);
  }

  async update(id: string, input: UpdateUserInput): Promise<UserRecord | null> {
    const result = await pool.query(
      'SELECT * FROM sp_update_user($1, $2, $3)',
      [id, input.fullName || null, input.phone || null],
    );
    if (result.rows.length === 0) return null;
    return mapUser(result.rows[0]);
  }

  async softDelete(id: string): Promise<void> {
    await pool.query('SELECT sp_soft_delete_user($1)', [id]);
  }
}
