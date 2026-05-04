import express from 'express';
import swaggerUi from 'swagger-ui-express';
import routes from './routes';
import { errorHandler } from './middlewares/error.middleware';

const swaggerDocument = require('./docs/swagger.json');

const app = express();

app.use(express.json());

app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument));

app.use('/api', routes);

app.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});

// el error handler global tiene que ir al final
app.use(errorHandler);

export default app;
