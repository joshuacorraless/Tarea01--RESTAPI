// Prueba el flujo completo del microservicio search:
//   HTTP request -> rate-limiter middleware -> controller -> service -> respuesta
// Mockea esClient para no necesitar ElasticSearch real.

import request from 'supertest';
import searchApp from '../app';

//  Mock: ElasticSearch
// El server.ts llama createIndex() al arrancar, pero en tests importamos
// solo app.ts — así evitamos que intente conectarse a ES al importar.
// IMPORTANTE: la ruta debe ser relativa al archivo de test, no absoluta.
jest.mock('../config/elasticsearch', () => ({
  INDEX: 'products',
  esClient: {
    search: jest.fn(),
    bulk: jest.fn(),
    indices: { delete: jest.fn() },
  },
  createIndex: jest.fn().mockResolvedValue(undefined),
}));

import { esClient } from '../config/elasticsearch';
const mockEsClient = esClient as jest.Mocked<typeof esClient>;

const searchApi = request(searchApp);

// Fixture
const fakeProduct = {
  id: 'item-1',
  restaurantId: 'rest-1',
  menuId: 'menu-1',
  nombre: 'Gallo Pinto',
  categoria: 'Desayunos',
  descripcion: 'Con natilla y huevo',
  precio: 2500,
  disponible: true,
};

function buildEsResponse(docs: typeof fakeProduct[]) {
  return { hits: { hits: docs.map(d => ({ _source: d })) } };
}

beforeEach(() => jest.clearAllMocks());

// GET /health
describe('GET /health', () => {
  it('responde 200 con status ok', async () => {
    const res = await searchApi.get('/health');

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
    expect(res.body.service).toBe('search');
  });
});

// GET /search/products?q=
describe('GET /search/products', () => {
  it('responde 200 con resultados cuando q tiene valor', async () => {
    (mockEsClient.search as jest.Mock).mockResolvedValueOnce(
      buildEsResponse([fakeProduct])
    );

    const res = await searchApi.get('/search/products?q=gallo');

    expect(res.status).toBe(200);
    expect(res.body.results).toHaveLength(1);
    expect(res.body.results[0].nombre).toBe('Gallo Pinto');
    expect(res.body.total).toBe(1);
  });

  it('responde 400 si q está ausente', async () => {
    const res = await searchApi.get('/search/products');

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('El parámetro q es requerido');
    expect(mockEsClient.search).not.toHaveBeenCalled();
  });

  it('responde 400 si q es cadena vacía', async () => {
    const res = await searchApi.get('/search/products?q=');

    expect(res.status).toBe(400);
  });

  it('responde 200 con results:[] si no hay matches', async () => {
    (mockEsClient.search as jest.Mock).mockResolvedValueOnce(
      buildEsResponse([])
    );

    const res = await searchApi.get('/search/products?q=noexiste');

    expect(res.status).toBe(200);
    expect(res.body.results).toEqual([]);
    expect(res.body.total).toBe(0);
  });
});

// GET /search/products/category/:categoria
describe('GET /search/products/category/:categoria', () => {
  it('responde 200 con los productos de la categoría', async () => {
    (mockEsClient.search as jest.Mock).mockResolvedValueOnce(
      buildEsResponse([fakeProduct])
    );

    const res = await searchApi.get('/search/products/category/Desayunos');

    expect(res.status).toBe(200);
    expect(res.body.results).toHaveLength(1);
    expect(res.body.results[0].categoria).toBe('Desayunos');
    expect(res.body.total).toBe(1);
  });

  it('responde 200 con lista vacía si la categoría no tiene productos', async () => {
    (mockEsClient.search as jest.Mock).mockResolvedValueOnce(
      buildEsResponse([])
    );

    const res = await searchApi.get('/search/products/category/CategoriaVacia');

    expect(res.status).toBe(200);
    expect(res.body.results).toEqual([]);
    expect(res.body.total).toBe(0);
  });

  it('acepta categorías con espacios en la URL', async () => {
    (mockEsClient.search as jest.Mock).mockResolvedValueOnce(
      buildEsResponse([fakeProduct])
    );

    const res = await searchApi.get(
      '/search/products/category/Platos%20Fuertes'
    );

    expect(res.status).toBe(200);
    expect(mockEsClient.search).toHaveBeenCalledWith(
      expect.objectContaining({
        query: { match: { categoria: 'Platos Fuertes' } },
      })
    );
  });
});

// POST /search/reindex
describe('POST /search/reindex', () => {
  it('responde 200 con el conteo de productos indexados', async () => {
    global.fetch = jest.fn().mockResolvedValueOnce({
      ok: true,
      json: jest.fn().mockResolvedValueOnce({
        success: true,
        data: [
          {
            id: 'item-1',
            restaurantId: 'rest-1',
            idMenu: 'menu-1',
            nombre: 'Gallo Pinto',
            categoria: 'Desayunos',
            detalles: 'Con natilla',
            precio: '2500',
            disponible: true,
          },
        ],
      }),
    } as any);

    (mockEsClient.indices.delete as jest.Mock).mockResolvedValueOnce({});
    (mockEsClient.bulk as jest.Mock).mockResolvedValueOnce({
      errors: false,
      items: [],
    });

    const res = await searchApi.post('/search/reindex');

    expect(res.status).toBe(200);
    expect(res.body.message).toBe('Reindex completado');
    expect(res.body.indexed).toBe(1);
  });

  it('responde 502 si la API interna no está disponible', async () => {
    global.fetch = jest.fn().mockResolvedValueOnce({ ok: false } as any);

    const res = await searchApi.post('/search/reindex');

    expect(res.status).toBe(502);
    expect(res.body.error).toBe('No se pudo obtener los productos de la API');
    expect(mockEsClient.bulk).not.toHaveBeenCalled();
  });

  it('responde 200 con indexed:0 si no hay productos', async () => {
    global.fetch = jest.fn().mockResolvedValueOnce({
      ok: true,
      json: jest.fn().mockResolvedValueOnce({ success: true, data: [] }),
    } as any);

    (mockEsClient.indices.delete as jest.Mock).mockResolvedValueOnce({});

    const res = await searchApi.post('/search/reindex');

    expect(res.status).toBe(200);
    expect(res.body.indexed).toBe(0);
    expect(mockEsClient.bulk).not.toHaveBeenCalled();
  });
});