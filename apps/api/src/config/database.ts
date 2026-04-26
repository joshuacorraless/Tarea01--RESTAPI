import { Pool } from 'pg';
import { env } from './env';

const pool = new Pool({
  connectionString: env.DATABASE_URL,
});

pool.on('error', (err) => {
  console.error('error inesperado en el pool de postgresql:', err);
  process.exit(1);
});

export async function connectPostgres(): Promise<void> {
  const client = await pool.connect();
  client.release();
  console.log('conectado a postgresql');
}

export default pool;
