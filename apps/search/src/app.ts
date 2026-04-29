import express from 'express';
import routes from './routes';

const app = express();

app.use(express.json());

// health check
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', service: 'search', timestamp: new Date().toISOString() });
});

// rutas bajo prefijo /search
app.use('/', routes);

// error handler global
app.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error(err);
  res.status(500).json({ error: 'Internal server error', message: err.message });
});

export default app;