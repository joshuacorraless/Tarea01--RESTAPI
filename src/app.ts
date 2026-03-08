import express from 'express';
import routes from './routes';
import { errorHandler } from './middlewares/error.middleware';
import { setupSwagger } from './docs/swagger';

const app = express();

// middleware global para parsear json
app.use(express.json());

// documentacion swagger en /api-docs
setupSwagger(app);

// rutas bajo prefijo /api
app.use('/api', routes);

// health check simple
app.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});

// error handler global (debe ir despues de las rutas)
app.use(errorHandler);

export default app;
