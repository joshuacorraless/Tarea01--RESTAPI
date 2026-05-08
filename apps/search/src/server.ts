import app from './app';
import { env } from './config/env';
import { createIndex } from './config/elasticsearch';

async function bootstrap() {
  await createIndex();

  app.listen(Number(env.PORT), () => {
    // eslint-disable-next-line no-console
    console.log(`Search service corriendo en http://localhost:${env.PORT}`);
  });
}

bootstrap().catch(err => {
  console.error('Failed to start search service:', err);
  process.exit(1);
});