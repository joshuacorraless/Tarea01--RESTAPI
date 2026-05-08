import express from 'express';
import routes from './routes';

const app = express();

app.use(express.json());

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', service: 'search', timestamp: new Date().toISOString() });
});

app.use('/', routes);

app.use((err: Error, req: express.Request, res: express.Response) => {
  console.error(err);
  res.status(500).json({ error: 'Internal server error', message: err.message });
});

export default app;