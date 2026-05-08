import { Request, Response } from 'express';
import {
  searchByText,
  searchByCategory,
  reindex,
} from '../controllers/search.controller';
import * as SearchService from '../services/search.service';
import type { ProductDocument } from '../services/search.service';

jest.mock('../services/search.service');
jest.mock('../config/elasticsearch', () => ({
  INDEX: 'products',
  esClient: {},
  createIndex: jest.fn(),
}));

const mockReq = (opts: Partial<Request> = {}): Request =>
  ({
    query: {},
    params: {},
    body: {},
    ...opts,
  }) as Request;

const mockRes = (): Response => {
  const json = jest.fn();
  const status = jest.fn().mockReturnValue({ json });
  return { json, status } as unknown as Response;
};

const fakeProduct: ProductDocument = {
  id: 'item-1',
  restaurantId: 'rest-1',
  menuId: 'menu-1',
  nombre: 'Gallo Pinto',
  categoria: 'Desayunos',
  descripcion: 'Con natilla',
  precio: 2500,
  disponible: true,
};

beforeEach(() => jest.clearAllMocks());

describe('searchByText controller', () => {
  it('responde con los resultados cuando q tiene valor', async () => {
    (SearchService.searchByText as jest.Mock).mockResolvedValueOnce([fakeProduct]);

    const res = mockRes();
    await searchByText(mockReq({ query: { q: 'gallo' } }), res);

    expect(SearchService.searchByText).toHaveBeenCalledWith('gallo');
    expect(res.json).toHaveBeenCalledWith({
      results: [fakeProduct],
      total: 1,
    });
  });

  it('hace trim del query antes de enviarlo al service', async () => {
    (SearchService.searchByText as jest.Mock).mockResolvedValueOnce([]);

    await searchByText(mockReq({ query: { q: '  casado  ' } }), mockRes());

    expect(SearchService.searchByText).toHaveBeenCalledWith('casado');
  });

  it('responde 400 si q está ausente', async () => {
    const res = mockRes();
    await searchByText(mockReq({ query: {} }), res);

    expect(SearchService.searchByText).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(400);
    expect((res.status as jest.Mock)().json).toHaveBeenCalledWith({
      error: 'El parámetro q es requerido',
    });
  });

  it('responde 400 si q es una cadena vacía', async () => {
    const res = mockRes();
    await searchByText(mockReq({ query: { q: '' } }), res);

    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('responde 400 si q es solo espacios', async () => {
    const res = mockRes();
    await searchByText(mockReq({ query: { q: '   ' } }), res);

    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('retorna total:0 cuando no hay resultados', async () => {
    (SearchService.searchByText as jest.Mock).mockResolvedValueOnce([]);

    const res = mockRes();
    await searchByText(mockReq({ query: { q: 'noexiste' } }), res);

    expect(res.json).toHaveBeenCalledWith({ results: [], total: 0 });
  });
});

describe('searchByCategory controller', () => {
  it('retorna los productos de la categoría solicitada', async () => {
    (SearchService.searchByCategory as jest.Mock).mockResolvedValueOnce([fakeProduct]);

    const res = mockRes();
    await searchByCategory(
      mockReq({ params: { categoria: 'Desayunos' } }),
      res
    );

    expect(SearchService.searchByCategory).toHaveBeenCalledWith('Desayunos');
    expect(res.json).toHaveBeenCalledWith({
      results: [fakeProduct],
      total: 1,
    });
  });

  it('retorna total:0 si la categoría no tiene productos', async () => {
    (SearchService.searchByCategory as jest.Mock).mockResolvedValueOnce([]);

    const res = mockRes();
    await searchByCategory(
      mockReq({ params: { categoria: 'CategoriaVacia' } }),
      res
    );

    expect(res.json).toHaveBeenCalledWith({ results: [], total: 0 });
  });

  it('pasa la categoría exacta al service (case-sensitive)', async () => {
    (SearchService.searchByCategory as jest.Mock).mockResolvedValueOnce([]);

    await searchByCategory(
      mockReq({ params: { categoria: 'Platos Fuertes' } }),
      mockRes()
    );

    expect(SearchService.searchByCategory).toHaveBeenCalledWith('Platos Fuertes');
  });
});

describe('reindex controller', () => {
  function mockFetchSuccess(items: any[]) {
    global.fetch = jest.fn().mockResolvedValueOnce({
      ok: true,
      json: jest.fn().mockResolvedValueOnce({ success: true, data: items }),
    } as any);
  }

  function mockFetchFailure() {
    global.fetch = jest.fn().mockResolvedValueOnce({
      ok: false,
    } as any);
  }

  const apiItem = {
    id: 'item-1',
    restaurantId: 'rest-1',
    idMenu: 'menu-1',
    nombre: 'Gallo Pinto',
    categoria: 'Desayunos',
    detalles: 'Con natilla',
    precio: '2500',
    disponible: true,
  };

  it('reindexea los productos y responde con el conteo', async () => {
    mockFetchSuccess([apiItem]);
    (SearchService.reindex as jest.Mock).mockResolvedValueOnce({ indexed: 1 });

    const res = mockRes();
    await reindex(mockReq(), res);

    expect(SearchService.reindex).toHaveBeenCalledWith([
      {
        id: 'item-1',
        restaurantId: 'rest-1',
        menuId: 'menu-1',
        nombre: 'Gallo Pinto',
        categoria: 'Desayunos',
        descripcion: 'Con natilla',
        precio: 2500,
        disponible: true,
      },
    ]);
    expect(res.json).toHaveBeenCalledWith({
      message: 'Reindex completado',
      indexed: 1,
    });
  });

  it('usa "General" como categoria si el item no tiene categoria', async () => {
    mockFetchSuccess([{ ...apiItem, categoria: null }]);
    (SearchService.reindex as jest.Mock).mockResolvedValueOnce({ indexed: 1 });

    await reindex(mockReq(), mockRes());

    const reindexCall = (SearchService.reindex as jest.Mock).mock.calls[0][0];
    expect(reindexCall[0].categoria).toBe('General');
  });

  it('usa "Producto sin descripción" como descripcion si detalles es null', async () => {
    mockFetchSuccess([{ ...apiItem, detalles: null }]);
    (SearchService.reindex as jest.Mock).mockResolvedValueOnce({ indexed: 1 });

    await reindex(mockReq(), mockRes());

    const reindexCall = (SearchService.reindex as jest.Mock).mock.calls[0][0];
    expect(reindexCall[0].descripcion).toBe('Producto sin descripción');
  });

  it('convierte precio a Number correctamente', async () => {
    mockFetchSuccess([{ ...apiItem, precio: '3500.50' }]);
    (SearchService.reindex as jest.Mock).mockResolvedValueOnce({ indexed: 1 });

    await reindex(mockReq(), mockRes());

    const reindexCall = (SearchService.reindex as jest.Mock).mock.calls[0][0];
    expect(reindexCall[0].precio).toBe(3500.5);
    expect(typeof reindexCall[0].precio).toBe('number');
  });

  it('responde 502 si la API interna no responde correctamente', async () => {
    mockFetchFailure();

    const res = mockRes();
    await reindex(mockReq(), res);

    expect(SearchService.reindex).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(502);
    expect((res.status as jest.Mock)().json).toHaveBeenCalledWith({
      error: 'No se pudo obtener los productos de la API',
    });
  });

  it('maneja lista vacía de productos correctamente', async () => {
    mockFetchSuccess([]);
    (SearchService.reindex as jest.Mock).mockResolvedValueOnce({ indexed: 0 });

    const res = mockRes();
    await reindex(mockReq(), res);

    expect(res.json).toHaveBeenCalledWith({
      message: 'Reindex completado',
      indexed: 0,
    });
  });
});