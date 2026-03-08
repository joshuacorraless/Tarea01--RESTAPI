import swaggerUi from 'swagger-ui-express';
import { Express } from 'express';
import swaggerDocument from './swagger.json';

// configura swagger ui en /api-docs
export function setupSwagger(app: Express): void {
  app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument));
}
