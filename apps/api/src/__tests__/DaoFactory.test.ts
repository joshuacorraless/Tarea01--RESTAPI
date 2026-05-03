// DaoFactory.test.ts
//
// El DaoFactory usa una IIFE (función que se ejecuta inmediatamente al importar).
// Eso hace que jest.mock() normal no funcione para cambiar DB_ENGINE después
// de que el módulo ya fue cargado.
//
// La solución es jest.isolateModules(): carga el módulo desde cero dentro
// de un contexto aislado, permitiendo cambiar la env antes de cada import.

// ─── Mock de todas las dependencias de BD ────────────────────────────────────
// Necesitamos mockear estos módulos para que no intenten conectarse a nada real.
jest.mock('../config/database', () => ({
  connectPostgres: jest.fn().mockResolvedValue(undefined),
  query: jest.fn(),
}));

jest.mock('../config/database.mongo', () => ({
  connectMongo: jest.fn().mockResolvedValue(undefined),
}));

// Mocks de todos los DAOs — cada uno retorna una clase vacía
jest.mock('../dao/postgres/PostgresUserDao', () => ({ PostgresUserDao: jest.fn().mockImplementation(() => ({})) }));
jest.mock('../dao/postgres/PostgresRestaurantDao', () => ({ PostgresRestaurantDao: jest.fn().mockImplementation(() => ({})) }));
jest.mock('../dao/postgres/PostgresMenuDao', () => ({ PostgresMenuDao: jest.fn().mockImplementation(() => ({})) }));
jest.mock('../dao/postgres/PostgresMenuItemDao', () => ({ PostgresMenuItemDao: jest.fn().mockImplementation(() => ({})) }));
jest.mock('../dao/postgres/PostgresReservationDao', () => ({ PostgresReservationDao: jest.fn().mockImplementation(() => ({})) }));
jest.mock('../dao/postgres/PostgresOrderDao', () => ({ PostgresOrderDao: jest.fn().mockImplementation(() => ({})) }));

jest.mock('../dao/mongo/MongoUserDao', () => ({ MongoUserDao: jest.fn().mockImplementation(() => ({})) }));
jest.mock('../dao/mongo/MongoRestaurantDao', () => ({ MongoRestaurantDao: jest.fn().mockImplementation(() => ({})) }));
jest.mock('../dao/mongo/MongoMenuDao', () => ({ MongoMenuDao: jest.fn().mockImplementation(() => ({})) }));
jest.mock('../dao/mongo/MongoMenuItemDao', () => ({ MongoMenuItemDao: jest.fn().mockImplementation(() => ({})) }));
jest.mock('../dao/mongo/MongoReservationDao', () => ({ MongoReservationDao: jest.fn().mockImplementation(() => ({})) }));
jest.mock('../dao/mongo/MongoOrderDao', () => ({ MongoOrderDao: jest.fn().mockImplementation(() => ({})) }));

// ─── Tests ────────────────────────────────────────────────────────────────────
describe('DaoFactory — dao registry', () => {
  afterEach(() => {
    jest.resetModules();
    delete process.env.DB_ENGINE;
  });

  it('retorna DAOs de Postgres cuando DB_ENGINE=postgres', () => {
    process.env.DB_ENGINE = 'postgres';

    // isolateModules: recarga el módulo limpio con el nuevo DB_ENGINE
    jest.isolateModules(() => {
      const { dao } = require('../dao/DaoFactory');

      expect(dao.users).toBeDefined();
      expect(dao.restaurants).toBeDefined();
      expect(dao.menus).toBeDefined();
      expect(dao.menuItems).toBeDefined();
      expect(dao.reservations).toBeDefined();
      expect(dao.orders).toBeDefined();
    });
  });

  it('retorna DAOs de Mongo cuando DB_ENGINE=mongo', () => {
    process.env.DB_ENGINE = 'mongo';

    jest.isolateModules(() => {
      const { dao } = require('../dao/DaoFactory');

      expect(dao.users).toBeDefined();
      expect(dao.restaurants).toBeDefined();
      expect(dao.menus).toBeDefined();
      expect(dao.menuItems).toBeDefined();
      expect(dao.reservations).toBeDefined();
      expect(dao.orders).toBeDefined();
    });
  });
});

describe('DaoFactory — initDaoEngine', () => {
  afterEach(() => {
    jest.resetModules();
    delete process.env.DB_ENGINE;
  });

  it('resuelve sin error cuando DB_ENGINE=postgres', async () => {
    process.env.DB_ENGINE = 'postgres';

    await jest.isolateModulesAsync(async () => {
      const { initDaoEngine } = require('../dao/DaoFactory');
      await expect(initDaoEngine()).resolves.toBeUndefined();
    });
  });

  it('resuelve sin error cuando DB_ENGINE=mongo', async () => {
    process.env.DB_ENGINE = 'mongo';

    await jest.isolateModulesAsync(async () => {
      const { initDaoEngine } = require('../dao/DaoFactory');
      await expect(initDaoEngine()).resolves.toBeUndefined();
    });
  });
});