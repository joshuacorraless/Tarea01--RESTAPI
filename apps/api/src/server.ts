import app from './app';
import { env } from './config/env';
import { initDaoEngine } from './dao/DaoFactory';
import { connectRedis } from './config/redis';

const port = parseInt(env.PORT, 10);

async function start(): Promise<void> {
  await initDaoEngine();
  await connectRedis();
  app.listen(port, () => {
    console.log(`servidor corriendo en http://localhost:${port}`);
    console.log(`swagger docs en http://localhost:${port}/api-docs`);
  });
}

start().catch((err) => {
  console.error('fallo al iniciar el servidor:', err);
  process.exit(1);
});
