import '../setup';
import { api, mockAuthUser } from './setup';
import pool from '../../config/database';
import * as redisConfig from '../../config/redis';

const mockedPool = pool as jest.Mocked<typeof pool>;

const restaurantRow = {
  id: 'rest-1',
  name: 'La Soda del TEC',
  description: 'Comida típica costarricense',
  address: 'Cartago Centro',
  phone: '22221234',
  opening_hours: 'L-V 7am-5pm',
  admin_user_id: 'u-1',
  created_at: new Date('2025-01-01'),
  updated_at: new Date('2025-01-01'),
  admin_name: 'Carlos Admin',
  admin_email: 'carlos@admin.com',
};

// Respuesta cacheada que Redis devuelve en un HIT
const cachedResponse = {
  success: true,
  message: 'restaurants retrieved successfully',
  data: [
    {
      id: 'rest-1',
      name: 'La Soda del TEC',
      description: 'Comida típica costarricense',
      address: 'Cartago Centro',
      phone: '22221234',
      openingHours: 'L-V 7am-5pm',
      adminUser: { fullName: 'Carlos Admin', email: 'carlos@admin.com' },
    },
  ],
};

// GET /api/restaurants — sin caché (MISS)
describe('GET /api/restaurants', () => {
  it('responde 200 con la lista de restaurantes sin token', async () => {
    // Este endpoint es público — no requiere Authorization header
    (mockedPool.query as jest.Mock).mockResolvedValueOnce({
      rows: [restaurantRow],
    });

    const res = await api.get('/api/restaurants');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveLength(1);
  });

  it('el response incluye adminUser con fullName y email', async () => {
    (mockedPool.query as jest.Mock).mockResolvedValueOnce({
      rows: [restaurantRow],
    });

    const res = await api.get('/api/restaurants');

    expect(res.body.data[0].adminUser).toMatchObject({
      fullName: 'Carlos Admin',
      email: 'carlos@admin.com',
    });
  });

  it('retorna lista vacía si no hay restaurantes', async () => {
    (mockedPool.query as jest.Mock).mockResolvedValueOnce({ rows: [] });

    const res = await api.get('/api/restaurants');

    expect(res.status).toBe(200);
    expect(res.body.data).toEqual([]);
  });

  it('responde 200 aunque no haya header Authorization (endpoint público)', async () => {
    (mockedPool.query as jest.Mock).mockResolvedValueOnce({ rows: [] });

    const res = await api.get('/api/restaurants');
    expect(res.status).toBe(200);
  });
});

// GET /api/restaurants — caché Redis
// Estos tests sobreescriben temporalmente el mock de Redis del setup (que
// devuelve null) para simular un cliente real con datos en caché.
// Usan beforeEach/afterEach para restaurar el mock original después de cada
// test y no contaminar los demás tests del archivo.
describe('GET /api/restaurants — caché Redis', () => {
  afterEach(() => {
    // Restaurar para que los otros describes sigan con Redis = null
    (redisConfig.getRedisClient as jest.Mock).mockReturnValue(null);
  });

  it('devuelve X-Cache: HIT y la respuesta cacheada cuando Redis tiene el valor', async () => {
    // Simular un cliente Redis con datos en caché para esta URL
    const mockRedisClient = {
      get: jest.fn().mockResolvedValueOnce(JSON.stringify(cachedResponse)),
      setEx: jest.fn().mockResolvedValue(undefined),
      keys: jest.fn().mockResolvedValue([]),
      del: jest.fn().mockResolvedValue(undefined),
    };
    (redisConfig.getRedisClient as jest.Mock).mockReturnValue(mockRedisClient);

    const res = await api.get('/api/restaurants');

    // El middleware devuelve la respuesta cacheada directamente
    expect(res.status).toBe(200);
    expect(res.headers['x-cache']).toBe('HIT');
    expect(res.body).toEqual(cachedResponse);

    // La BD NO fue consultada
    expect(mockedPool.query).not.toHaveBeenCalled();
  });

  it('devuelve X-Cache: MISS y consulta la BD cuando Redis no tiene el valor', async () => {
    // Cliente Redis disponible pero sin datos para esta clave
    const mockRedisClient = {
      get: jest.fn().mockResolvedValueOnce(null),  // MISS
      setEx: jest.fn().mockResolvedValue(undefined),
      keys: jest.fn().mockResolvedValue([]),
      del: jest.fn().mockResolvedValue(undefined),
    };
    (redisConfig.getRedisClient as jest.Mock).mockReturnValue(mockRedisClient);

    (mockedPool.query as jest.Mock).mockResolvedValueOnce({
      rows: [restaurantRow],
    });

    const res = await api.get('/api/restaurants');

    expect(res.status).toBe(200);
    expect(res.headers['x-cache']).toBe('MISS');

    // La BD SÍ fue consultada porque no había caché
    expect(mockedPool.query).toHaveBeenCalled();

    // El resultado fue guardado en Redis para el próximo request
    expect(mockRedisClient.setEx).toHaveBeenCalledWith(
      'cache:/api/restaurants',
      120,  // TTL definido en restaurant.routes.ts
      expect.any(String),
    );
  });

  it('ignora el error de Redis y sirve desde la BD si Redis falla', async () => {
    // Cliente Redis que lanza error al consultar
    const mockRedisClient = {
      get: jest.fn().mockRejectedValueOnce(new Error('connection refused')),
      setEx: jest.fn(),
      keys: jest.fn(),
      del: jest.fn(),
    };
    (redisConfig.getRedisClient as jest.Mock).mockReturnValue(mockRedisClient);

    (mockedPool.query as jest.Mock).mockResolvedValueOnce({
      rows: [restaurantRow],
    });

    const res = await api.get('/api/restaurants');

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);

    // Redis falló
    expect(mockRedisClient.setEx).not.toHaveBeenCalled();
  });
});

// POST /api/restaurants
describe('POST /api/restaurants', () => {
  const validBody = {
    name: 'La Trattoria',
    address: 'San José Centro',
    description: 'Comida italiana',
    phone: '22334455',
    openingHours: 'L-D 11am-10pm',
  };

  it('crea un restaurante y responde 201 con rol restaurant_admin', async () => {
    mockAuthUser.roles = ['restaurant_admin'];

    (mockedPool.query as jest.Mock)
      .mockResolvedValueOnce({ rows: [{ id: 'u-1', external_auth_id: 'test-user-kc-id' }] })
      .mockResolvedValueOnce({ rows: [{ ...restaurantRow, name: 'La Trattoria' }] });

    const res = await api
      .post('/api/restaurants')
      .set('Authorization', 'Bearer fake-token')
      .send(validBody);

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.message).toBe('restaurant created successfully');
  });

  it('responde 403 si el usuario tiene rol client (no restaurant_admin)', async () => {
    mockAuthUser.roles = ['client'];

    const res = await api
      .post('/api/restaurants')
      .set('Authorization', 'Bearer fake-token')
      .send(validBody);

    expect(res.status).toBe(403);
  });

  it('responde 400 si falta el campo name (validación Zod)', async () => {
    mockAuthUser.roles = ['restaurant_admin'];

    const res = await api
      .post('/api/restaurants')
      .set('Authorization', 'Bearer fake-token')
      .send({ address: 'San José' });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('responde 400 si falta el campo address', async () => {
    mockAuthUser.roles = ['restaurant_admin'];

    const res = await api
      .post('/api/restaurants')
      .set('Authorization', 'Bearer fake-token')
      .send({ name: 'La Trattoria' });

    expect(res.status).toBe(400);
  });
});