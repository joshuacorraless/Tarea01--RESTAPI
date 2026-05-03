import { searchByText, searchByCategory, reindex } from '../services/search.service';
import type { ProductDocument } from '../services/search.service';


jest.mock('../config/elasticsearch', () => ({
  INDEX: 'products',
  esClient: {
    search: jest.fn(),
    bulk: jest.fn(),
    indices: {
      delete: jest.fn(),
    },
  },
  createIndex: jest.fn(),
}));

import { esClient, createIndex } from '../config/elasticsearch';

const mockEsClient = esClient as jest.Mocked<typeof esClient>;
const mockCreateIndex = createIndex as jest.Mock;

const product1: ProductDocument = {
  id: 'item-1',
  restaurantId: 'rest-1',
  menuId: 'menu-1',
  nombre: 'Gallo Pinto',
  categoria: 'Desayunos',
  descripcion: 'Con natilla y huevo',
  precio: 2500,
  disponible: true,
};

const product2: ProductDocument = {
  id: 'item-2',
  restaurantId: 'rest-1',
  menuId: 'menu-1',
  nombre: 'Casado de res',
  categoria: 'Platos Fuertes',
  descripcion: 'Con ensalada y arroz',
  precio: 4500,
  disponible: true,
};

function buildEsSearchResponse(docs: ProductDocument[]) {
  return {
    hits: {
      hits: docs.map(doc => ({ _source: doc })),
    },
  };
}

beforeEach(() => jest.clearAllMocks());

describe('searchByText', () => {
  it('retorna los productos que matchean el texto', async () => {
    (mockEsClient.search as jest.Mock).mockResolvedValueOnce(
      buildEsSearchResponse([product1, product2])
    );

    const results = await searchByText('gallo');

    expect(results).toHaveLength(2);
    expect(results[0].nombre).toBe('Gallo Pinto');
    expect(results[1].nombre).toBe('Casado de res');
  });

  it('llama a esClient.search con multi_match en los campos correctos', async () => {
    (mockEsClient.search as jest.Mock).mockResolvedValueOnce(
      buildEsSearchResponse([product1])
    );

    await searchByText('casado');

    expect(mockEsClient.search).toHaveBeenCalledWith({
      index: 'products',
      query: {
        multi_match: {
          query: 'casado',
          fields: ['nombre^3', 'categoria^2', 'descripcion'],
        },
      },
    });
  });

  it('retorna arreglo vacío si no hay resultados', async () => {
    (mockEsClient.search as jest.Mock).mockResolvedValueOnce(
      buildEsSearchResponse([])
    );

    const results = await searchByText('pizzafantasma');
    expect(results).toEqual([]);
  });

  it('propaga el error si esClient.search falla', async () => {
    (mockEsClient.search as jest.Mock).mockRejectedValueOnce(
      new Error('ES connection refused')
    );

    await expect(searchByText('gallo')).rejects.toThrow('ES connection refused');
  });
});

describe('searchByCategory', () => {
  it('retorna los productos de la categoría indicada', async () => {
    (mockEsClient.search as jest.Mock).mockResolvedValueOnce(
      buildEsSearchResponse([product1])
    );

    const results = await searchByCategory('Desayunos');

    expect(results).toHaveLength(1);
    expect(results[0].categoria).toBe('Desayunos');
  });

  it('llama a esClient.search con match en el campo categoria', async () => {
    (mockEsClient.search as jest.Mock).mockResolvedValueOnce(
      buildEsSearchResponse([])
    );

    await searchByCategory('Postres');

    expect(mockEsClient.search).toHaveBeenCalledWith({
      index: 'products',
      query: {
        match: { categoria: 'Postres' },
      },
    });
  });

  it('retorna arreglo vacío si no hay productos en esa categoría', async () => {
    (mockEsClient.search as jest.Mock).mockResolvedValueOnce(
      buildEsSearchResponse([])
    );

    const results = await searchByCategory('CategoriaInexistente');
    expect(results).toEqual([]);
  });

  it('propaga el error si esClient.search falla', async () => {
    (mockEsClient.search as jest.Mock).mockRejectedValueOnce(
      new Error('index not found')
    );

    await expect(searchByCategory('Sopas')).rejects.toThrow('index not found');
  });
});

describe('reindex', () => {
  beforeEach(() => {
    (mockEsClient.bulk as jest.Mock).mockResolvedValue({ errors: false, items: [] });
    (mockEsClient.indices.delete as jest.Mock).mockResolvedValue({});
    mockCreateIndex.mockResolvedValue(undefined);
  });

  it('retorna { indexed: 0 } si se pasa un arreglo vacío', async () => {
    const result = await reindex([]);

    expect(mockEsClient.bulk).not.toHaveBeenCalled();
    expect(result).toEqual({ indexed: 0 });
  });

  it('borra el índice existente y lo recrea antes de indexar', async () => {
    await reindex([product1]);

    expect(mockEsClient.indices.delete).toHaveBeenCalledWith({
      index: 'products',
      ignore_unavailable: true,
    });
    expect(mockCreateIndex).toHaveBeenCalled();
  });

  it('llama a bulk con las operaciones correctas para cada producto', async () => {
    await reindex([product1]);

    expect(mockEsClient.bulk).toHaveBeenCalledWith({
      operations: [
        { index: { _index: 'products', _id: 'item-1' } },
        { ...product1, descripcion: 'Con natilla y huevo' },
      ],
      refresh: true,
    });
  });

  it('usa "Producto sin descripción" cuando descripcion está vacía', async () => {
    const sinDescripcion: ProductDocument = {
      ...product1,
      id: 'item-sindes',
      descripcion: '',
    };

    await reindex([sinDescripcion]);

    const bulkCall = (mockEsClient.bulk as jest.Mock).mock.calls[0][0];
    const doc = bulkCall.operations[1];
    expect(doc.descripcion).toBe('Producto sin descripción');
  });

  it('usa "Producto sin descripción" cuando descripcion es solo espacios', async () => {
    const soloEspacios: ProductDocument = {
      ...product1,
      id: 'item-espacios',
      descripcion: '   ',
    };

    await reindex([soloEspacios]);

    const bulkCall = (mockEsClient.bulk as jest.Mock).mock.calls[0][0];
    const doc = bulkCall.operations[1];
    expect(doc.descripcion).toBe('Producto sin descripción');
  });

  it('retorna el conteo correcto de productos indexados', async () => {
    const result = await reindex([product1, product2]);
    expect(result).toEqual({ indexed: 2 });
  });

  it('indexa múltiples productos con operaciones bulk correctas', async () => {
    await reindex([product1, product2]);

    const bulkCall = (mockEsClient.bulk as jest.Mock).mock.calls[0][0];
    expect(bulkCall.operations).toHaveLength(4);
    expect(bulkCall.operations[0]).toEqual({ index: { _index: 'products', _id: 'item-1' } });
    expect(bulkCall.operations[2]).toEqual({ index: { _index: 'products', _id: 'item-2' } });
  });

  it('no lanza error si bulk reporta errores parciales (solo logea)', async () => {
    (mockEsClient.bulk as jest.Mock).mockResolvedValueOnce({
      errors: true,
      items: [{ index: { error: { reason: 'document too large' } } }],
    });

    // No debe lanzar — el service solo logea los errores parciales
    await expect(reindex([product1])).resolves.toEqual({ indexed: 1 });
  });

  it('propaga el error si esClient.bulk falla completamente', async () => {
    (mockEsClient.bulk as jest.Mock).mockRejectedValueOnce(
      new Error('bulk request failed')
    );

    await expect(reindex([product1])).rejects.toThrow('bulk request failed');
  });
});