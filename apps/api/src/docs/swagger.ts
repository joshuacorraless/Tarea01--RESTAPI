import swaggerUi from 'swagger-ui-express';
import { Express } from 'express';

const swaggerDocument = require('./swagger.json');

// configura swagger ui en /api-docs
export const setupSwagger = (app: Express): void => {
  app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument));
};
