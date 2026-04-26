import express from 'express';
import swaggerUi from 'swagger-ui-express';
import routes from './routes';
import { errorHandler } from './middlewares/error.middleware';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const swaggerDocument = require('./docs/swagger.json');

const app = express();

// middleware global para parsear json
app.use(express.json());

// documentacion swagger en /api-docs
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument));

// rutas bajo prefijo /api
app.use('/api', routes);

// health check simple
app.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});

// error handler global (debe ir despues de las rutas)
app.use(errorHandler);

export default app;
