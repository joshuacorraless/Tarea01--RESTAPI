import { Pool } from 'pg';
import { env } from './env';

// pool de conexiones a postgresql
// el pool maneja multiples conexiones y las reutiliza automaticamente
const pool = new Pool({
  connectionString: env.DATABASE_URL,
});

// verificar conexion al iniciar
pool.on('error', (err) => {
  console.error('error inesperado en el pool de postgresql:', err);
  process.exit(1);
});

export default pool;
