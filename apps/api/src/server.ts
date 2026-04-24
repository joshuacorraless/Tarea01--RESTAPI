import app from './app';
import { env } from './config/env';

const port = parseInt(env.PORT, 10);

app.listen(port, () => {
  console.log(`servidor corriendo en http://localhost:${port}`);
  console.log(`swagger docs en http://localhost:${port}/api-docs`);
});
