// Tests unitarios para los 6 DAOs de MongoDB.
// Mockean los modelos Mongoose — no requieren conexion real.

import { MongoMenuDao } from '../dao/mongo/MongoMenuDao';
import { MongoMenuItemDao } from '../dao/mongo/MongoMenuItemDao';
import { MongoOrderDao } from '../dao/mongo/MongoOrderDao';
import { MongoReservationDao } from '../dao/mongo/MongoReservationDao';
import { MongoRestaurantDao } from '../dao/mongo/MongoRestaurantDao';
import { MongoUserDao } from '../dao/mongo/MongoUserDao';

// ─── Mocks de modelos ────────────────────────────────────────────────────────

jest.mock('../dao/mongo/models/UserModel', () => ({
  UserModel: {
    create: jest.fn(),
    findOne: jest.fn(),
    findOneAndUpdate: jest.fn(),
  },
}));

jest.mock('../dao/mongo/models/RestaurantModel', () => ({
  RestaurantModel: {
    create: jest.fn(),
    aggregate: jest.fn(),
  },
}));

jest.mock('../dao/mongo/models/MenuModel', () => ({
  MenuModel: {
    create: jest.fn(),
    findOne: jest.fn(),
    find: jest.fn(),
    findOneAndUpdate: jest.fn(),
  },
}));

jest.mock('../dao/mongo/models/MenuItemModel', () => ({
  MenuItemModel: {
    create: jest.fn(),
    findOne: jest.fn(),
    find: jest.fn(),
    findOneAndUpdate: jest.fn(),
  },
}));

jest.mock('../dao/mongo/models/TableModel', () => ({
  TableModel: {
    find: jest.fn(),
  },
}));

jest.mock('../dao/mongo/models/ReservationModel', () => ({
  ReservationModel: {
    create: jest.fn(),
    findOne: jest.fn(),
    find: jest.fn(),
    findOneAndUpdate: jest.fn(),
    distinct: jest.fn(),
  },
}));

jest.mock('../dao/mongo/models/OrderModel', () => ({
  OrderModel: {
    create: jest.fn(),
    findOne: jest.fn(),
    find: jest.fn(),
    findOneAndUpdate: jest.fn(),
  },
}));

// Accesos directos a los mocks
import { UserModel } from '../dao/mongo/models/UserModel';
import { RestaurantModel } from '../dao/mongo/models/RestaurantModel';
import { MenuModel } from '../dao/mongo/models/MenuModel';
import { MenuItemModel } from '../dao/mongo/models/MenuItemModel';
import { TableModel } from '../dao/mongo/models/TableModel';
import { ReservationModel } from '../dao/mongo/models/ReservationModel';
import { OrderModel } from '../dao/mongo/models/OrderModel';

const mUser = UserModel as jest.Mocked<typeof UserModel>;
const mRestaurant = RestaurantModel as jest.Mocked<typeof RestaurantModel>;
const mMenu = MenuModel as jest.Mocked<typeof MenuModel>;
const mMenuItem = MenuItemModel as jest.Mocked<typeof MenuItemModel>;
const mTable = TableModel as jest.Mocked<typeof TableModel>;
const mReservation = ReservationModel as jest.Mocked<typeof ReservationModel>;
const mOrder = OrderModel as jest.Mocked<typeof OrderModel>;

beforeEach(() => jest.clearAllMocks());

// ─── Fixtures ────────────────────────────────────────────────────────────────

const NOW = new Date('2025-01-01T10:00:00Z');

const userDoc = {
  _id: 'user-1',
  fullName: 'Carlos Mora',
  email: 'carlos@test.com',
  externalAuthId: 'ext-1',
  role: 'client' as const,
  phone: null,
  deletedAt: null,
  createdAt: NOW,
  updatedAt: NOW,
};

const restaurantDoc = {
  _id: 'rest-1',
  name: 'La Cantina',
  description: null,
  address: 'Calle 5',
  phone: null,
  openingHours: null,
  adminUserId: 'user-1',
  deletedAt: null,
  createdAt: NOW,
  updatedAt: NOW,
};

const menuDoc = {
  _id: 'menu-1',
  idRestaurante: 'rest-1',
  nombre: 'Almuerzo',
  detalles: 'Plato del dia',
  activo: true,
  deletedAt: null,
  creadoEn: NOW,
  ultimaActualizacion: NOW,
};

const menuItemDoc = {
  _id: 'item-1',
  idMenu: 'menu-1',
  nombre: 'Gallo Pinto',
  detalles: 'Con natilla',
  categoria: 'desayuno',
  precio: 2500,
  imagen: null,
  disponible: true,
  deletedAt: null,
  creadoEn: NOW,
  ultimaActualizacion: NOW,
};

const tableDoc = {
  _id: 'table-1',
  idRestaurante: 'rest-1',
  numeroMesa: 1,
  capacidad: 4,
  disponible: true,
};

const reservationDoc = {
  _id: 'res-1',
  idRestaurante: 'rest-1',
  mesaId: 'table-1',
  idClienteUsuario: 'user-1',
  tamannoReserva: 2,
  reservadoPara: NOW,
  duracionReserva: 90,
  estado: 'pendiente' as const,
  notas: null,
  deletedAt: null,
  creadoEn: NOW,
  ultimaActualizacion: NOW,
};

const orderDoc = {
  _id: 'order-1',
  idRestaurante: 'rest-1',
  idClienteUsuario: 'user-1',
  idReserva: null,
  tipoOrden: 'en-restaurante' as const,
  estado: 'pendiente' as const,
  total: 5000,
  notas: null,
  deletedAt: null,
  creadoEn: NOW,
  ultimaActualizacion: NOW,
  items: [
    {
      _id: 'oi-1',
      idItemMenu: 'item-1',
      cantidad: 2,
      precioUnidad: 2500,
      subtotal: 5000,
      notas: null,
    },
  ],
};

// ─── MongoUserDao ────────────────────────────────────────────────────────────

describe('MongoUserDao', () => {
  const dao = new MongoUserDao();

  it('create retorna registro mapeado', async () => {
    (mUser.create as jest.Mock).mockResolvedValueOnce(userDoc);
    const result = await dao.create({
      fullName: 'Carlos Mora',
      email: 'carlos@test.com',
      externalAuthId: 'ext-1',
      role: 'client',
    });
    expect(result.id).toBe('user-1');
    expect(result.fullName).toBe('Carlos Mora');
    expect(result.role).toBe('client');
  });

  it('getByExternalId retorna usuario si existe', async () => {
    (mUser.findOne as jest.Mock).mockResolvedValueOnce(userDoc);
    const result = await dao.getByExternalId('ext-1');
    expect(result?.id).toBe('user-1');
  });

  it('getByExternalId retorna null si no existe', async () => {
    (mUser.findOne as jest.Mock).mockResolvedValueOnce(null);
    expect(await dao.getByExternalId('ext-x')).toBeNull();
  });

  it('getById retorna usuario si existe', async () => {
    (mUser.findOne as jest.Mock).mockResolvedValueOnce(userDoc);
    const result = await dao.getById('user-1');
    expect(result?.email).toBe('carlos@test.com');
  });

  it('getById retorna null si no existe', async () => {
    (mUser.findOne as jest.Mock).mockResolvedValueOnce(null);
    expect(await dao.getById('x')).toBeNull();
  });

  it('update retorna usuario actualizado', async () => {
    const updated = { ...userDoc, fullName: 'Carlos Editado' };
    (mUser.findOneAndUpdate as jest.Mock).mockResolvedValueOnce(updated);
    const result = await dao.update('user-1', { fullName: 'Carlos Editado' });
    expect(result?.fullName).toBe('Carlos Editado');
  });

  it('update retorna null si usuario no existe', async () => {
    (mUser.findOneAndUpdate as jest.Mock).mockResolvedValueOnce(null);
    expect(await dao.update('x', {})).toBeNull();
  });

  it('softDelete llama findOneAndUpdate con deletedAt', async () => {
    (mUser.findOneAndUpdate as jest.Mock).mockResolvedValueOnce(userDoc);
    await dao.softDelete('user-1');
    expect(mUser.findOneAndUpdate).toHaveBeenCalledWith(
      { _id: 'user-1', deletedAt: null },
      { $set: { deletedAt: expect.any(Date) } },
    );
  });
});

// ─── MongoRestaurantDao ──────────────────────────────────────────────────────

describe('MongoRestaurantDao', () => {
  const dao = new MongoRestaurantDao();

  it('create retorna registro mapeado', async () => {
    (mRestaurant.create as jest.Mock).mockResolvedValueOnce(restaurantDoc);
    const result = await dao.create({
      name: 'La Cantina',
      address: 'Calle 5',
      adminUserId: 'user-1',
    });
    expect(result.id).toBe('rest-1');
    expect(result.name).toBe('La Cantina');
  });

  it('list retorna restaurantes con info de admin', async () => {
    const aggregateResult = [
      {
        ...restaurantDoc,
        adminUserDoc: { fullName: 'Carlos Mora', email: 'carlos@test.com' },
      },
    ];
    (mRestaurant.aggregate as jest.Mock).mockResolvedValueOnce(aggregateResult);
    const result = await dao.list();
    expect(result).toHaveLength(1);
    expect(result[0].adminUser.fullName).toBe('Carlos Mora');
    expect(result[0].adminUser.email).toBe('carlos@test.com');
  });

  it('list retorna arreglo vacio si no hay restaurantes', async () => {
    (mRestaurant.aggregate as jest.Mock).mockResolvedValueOnce([]);
    expect(await dao.list()).toEqual([]);
  });
});

// ─── MongoMenuDao ────────────────────────────────────────────────────────────

describe('MongoMenuDao', () => {
  const dao = new MongoMenuDao();

  it('create retorna registro mapeado', async () => {
    (mMenu.create as jest.Mock).mockResolvedValueOnce(menuDoc);
    const result = await dao.create({
      idRestaurante: 'rest-1',
      nombre: 'Almuerzo',
      detalles: 'Plato del dia',
      activo: true,
    });
    expect(result.id).toBe('menu-1');
    expect(result.idRestaurante).toBe('rest-1');
  });

  it('getById retorna menú si existe', async () => {
    (mMenu.findOne as jest.Mock).mockResolvedValueOnce(menuDoc);
    expect((await dao.getById('menu-1'))?.nombre).toBe('Almuerzo');
  });

  it('getById retorna null si no existe', async () => {
    (mMenu.findOne as jest.Mock).mockResolvedValueOnce(null);
    expect(await dao.getById('x')).toBeNull();
  });

  it('getByRestaurant retorna lista de menús', async () => {
    (mMenu.find as jest.Mock).mockResolvedValueOnce([menuDoc, menuDoc]);
    expect(await dao.getByRestaurant('rest-1')).toHaveLength(2);
  });

  it('update retorna menú actualizado', async () => {
    const updated = { ...menuDoc, nombre: 'Cena' };
    (mMenu.findOneAndUpdate as jest.Mock).mockResolvedValueOnce(updated);
    expect((await dao.update('menu-1', { nombre: 'Cena' }))?.nombre).toBe('Cena');
  });

  it('update retorna null si menú no existe', async () => {
    (mMenu.findOneAndUpdate as jest.Mock).mockResolvedValueOnce(null);
    expect(await dao.update('x', {})).toBeNull();
  });

  it('softDelete llama findOneAndUpdate con deletedAt', async () => {
    (mMenu.findOneAndUpdate as jest.Mock).mockResolvedValueOnce(menuDoc);
    await dao.softDelete('menu-1');
    expect(mMenu.findOneAndUpdate).toHaveBeenCalledWith(
      { _id: 'menu-1', deletedAt: null },
      { $set: { deletedAt: expect.any(Date) } },
    );
  });
});

// ─── MongoMenuItemDao ────────────────────────────────────────────────────────

describe('MongoMenuItemDao', () => {
  const dao = new MongoMenuItemDao();

  it('create retorna item mapeado', async () => {
    (mMenuItem.create as jest.Mock).mockResolvedValueOnce(menuItemDoc);
    const result = await dao.create('menu-1', {
      nombre: 'Gallo Pinto',
      detalles: 'Con natilla',
      categoria: 'desayuno',
      precio: 2500,
      disponible: true,
    });
    expect(result.id).toBe('item-1');
    expect(result.categoria).toBe('desayuno');
    expect(result.precio).toBe(2500);
  });

  it('getByMenu retorna items del menú', async () => {
    (mMenuItem.find as jest.Mock).mockResolvedValueOnce([menuItemDoc]);
    const items = await dao.getByMenu('menu-1');
    expect(items).toHaveLength(1);
    expect(items[0].nombre).toBe('Gallo Pinto');
  });

  it('update retorna item actualizado', async () => {
    const updated = { ...menuItemDoc, precio: 3000 };
    (mMenuItem.findOneAndUpdate as jest.Mock).mockResolvedValueOnce(updated);
    expect((await dao.update('menu-1', 'item-1', { precio: 3000 }))?.precio).toBe(3000);
  });

  it('update incluye idMenu (shard key) en el filtro', async () => {
    (mMenuItem.findOneAndUpdate as jest.Mock).mockResolvedValueOnce(menuItemDoc);
    await dao.update('menu-1', 'item-1', { precio: 3000 });
    expect(mMenuItem.findOneAndUpdate).toHaveBeenCalledWith(
      { _id: 'item-1', idMenu: 'menu-1', deletedAt: null },
      { $set: { precio: 3000 } },
      { new: true },
    );
  });

  it('update retorna null si item no existe', async () => {
    (mMenuItem.findOneAndUpdate as jest.Mock).mockResolvedValueOnce(null);
    expect(await dao.update('menu-1', 'x', {})).toBeNull();
  });

  it('softDelete llama findOneAndUpdate con deletedAt e idMenu (shard key)', async () => {
    (mMenuItem.findOneAndUpdate as jest.Mock).mockResolvedValueOnce(menuItemDoc);
    await dao.softDelete('menu-1', 'item-1');
    expect(mMenuItem.findOneAndUpdate).toHaveBeenCalledWith(
      { _id: 'item-1', idMenu: 'menu-1', deletedAt: null },
      { $set: { deletedAt: expect.any(Date) } },
    );
  });
});

// ─── MongoReservationDao ─────────────────────────────────────────────────────

describe('MongoReservationDao', () => {
  const dao = new MongoReservationDao();

  it('getAvailableTables retorna mesas sin solapamiento', async () => {
    (mReservation.distinct as jest.Mock).mockResolvedValueOnce(['table-busy']);
    (mTable.find as jest.Mock).mockResolvedValueOnce([tableDoc]);

    const tables = await dao.getAvailableTables('rest-1', NOW, 90);

    expect(tables).toHaveLength(1);
    expect(tables[0].id).toBe('table-1');
    // verifica que el filtro excluye las mesas ocupadas
    expect(mTable.find).toHaveBeenCalledWith(
      expect.objectContaining({ _id: { $nin: ['table-busy'] } }),
    );
  });

  it('getAvailableTables retorna lista vacia si todas estan ocupadas', async () => {
    (mReservation.distinct as jest.Mock).mockResolvedValueOnce(['table-1']);
    (mTable.find as jest.Mock).mockResolvedValueOnce([]);
    expect(await dao.getAvailableTables('rest-1', NOW, 90)).toEqual([]);
  });

  it('create retorna reserva mapeada cuando no hay conflicto', async () => {
    (mReservation.findOne as jest.Mock).mockResolvedValueOnce(null);
    (mReservation.create as jest.Mock).mockResolvedValueOnce(reservationDoc);
    const result = await dao.create({
      idRestaurante: 'rest-1',
      mesaId: 'table-1',
      idClienteUsuario: 'user-1',
      tamannoReserva: 2,
      reservadoPara: NOW,
    });
    expect(result.id).toBe('res-1');
    expect(result.estado).toBe('pendiente');
  });

  it('create lanza error si la mesa ya esta reservada en ese horario', async () => {
    (mReservation.findOne as jest.Mock).mockResolvedValueOnce(reservationDoc);
    await expect(
      dao.create({
        idRestaurante: 'rest-1',
        mesaId: 'table-1',
        idClienteUsuario: 'user-2',
        tamannoReserva: 2,
        reservadoPara: NOW,
      }),
    ).rejects.toThrow('mesa no disponible para el horario solicitado');
    expect(mReservation.create).not.toHaveBeenCalled();
  });

  it('getById retorna reserva si existe', async () => {
    (mReservation.findOne as jest.Mock).mockResolvedValueOnce(reservationDoc);
    expect((await dao.getById('res-1'))?.mesaId).toBe('table-1');
  });

  it('getById retorna null si no existe', async () => {
    (mReservation.findOne as jest.Mock).mockResolvedValueOnce(null);
    expect(await dao.getById('x')).toBeNull();
  });

  it('getByClient retorna reservas del cliente', async () => {
    (mReservation.find as jest.Mock).mockResolvedValueOnce([reservationDoc]);
    expect(await dao.getByClient('user-1')).toHaveLength(1);
  });

  it('getByRestaurant retorna reservas del restaurante', async () => {
    (mReservation.find as jest.Mock).mockResolvedValueOnce([reservationDoc, reservationDoc]);
    expect(await dao.getByRestaurant('rest-1')).toHaveLength(2);
  });

  it('cancel retorna reserva cancelada e incluye idRestaurante (shard key) en el filtro', async () => {
    const cancelled = { ...reservationDoc, estado: 'cancelada' as const };
    (mReservation.findOne as jest.Mock).mockResolvedValueOnce(reservationDoc);
    (mReservation.findOneAndUpdate as jest.Mock).mockResolvedValueOnce(cancelled);

    const result = await dao.cancel('res-1', 'user-1');

    expect(result?.estado).toBe('cancelada');
    expect(mReservation.findOneAndUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        _id: 'res-1',
        idRestaurante: 'rest-1',
        idClienteUsuario: 'user-1',
      }),
      { $set: { estado: 'cancelada' } },
      { new: true },
    );
  });

  it('cancel retorna null si la reserva no existe (sin segunda query)', async () => {
    (mReservation.findOne as jest.Mock).mockResolvedValueOnce(null);
    expect(await dao.cancel('x', 'user-1')).toBeNull();
    expect(mReservation.findOneAndUpdate).not.toHaveBeenCalled();
  });

  it('cancel retorna null si la reserva existe pero ya esta cancelada', async () => {
    (mReservation.findOne as jest.Mock).mockResolvedValueOnce(reservationDoc);
    (mReservation.findOneAndUpdate as jest.Mock).mockResolvedValueOnce(null);
    expect(await dao.cancel('res-1', 'user-1')).toBeNull();
  });
});

// ─── MongoOrderDao ───────────────────────────────────────────────────────────

describe('MongoOrderDao', () => {
  const dao = new MongoOrderDao();

  it('createWithItems calcula el total y retorna orden mapeada', async () => {
    (mMenuItem.find as jest.Mock).mockResolvedValueOnce([menuItemDoc]);
    (mOrder.create as jest.Mock).mockResolvedValueOnce(orderDoc);

    const result = await dao.createWithItems({
      idRestaurante: 'rest-1',
      idClienteUsuario: 'user-1',
      items: [{ idItemMenu: 'item-1', cantidad: 2 }],
    });

    expect(result.id).toBe('order-1');
    expect(result.total).toBe(5000);
    expect(result.items).toHaveLength(1);
    // verifica que se paso el total calculado al crear
    const createArg = (mOrder.create as jest.Mock).mock.calls[0][0];
    expect(createArg.total).toBe(5000);
  });

  it('createWithItems usa precio 0 si item no se encuentra', async () => {
    (mMenuItem.find as jest.Mock).mockResolvedValueOnce([]);
    const orderDocSinPrecio = {
      ...orderDoc,
      total: 0,
      items: [{ ...orderDoc.items[0], precioUnidad: 0, subtotal: 0 }],
    };
    (mOrder.create as jest.Mock).mockResolvedValueOnce(orderDocSinPrecio);

    const result = await dao.createWithItems({
      idRestaurante: 'rest-1',
      idClienteUsuario: 'user-1',
      items: [{ idItemMenu: 'item-inexistente', cantidad: 1 }],
    });

    expect(result.total).toBe(0);
  });

  it('getById retorna orden con items si existe', async () => {
    (mOrder.findOne as jest.Mock).mockResolvedValueOnce(orderDoc);
    const result = await dao.getById('order-1');
    expect(result?.id).toBe('order-1');
    expect(result?.items).toHaveLength(1);
    expect(result?.items[0].id).toBe('oi-1');
  });

  it('getById retorna null si no existe', async () => {
    (mOrder.findOne as jest.Mock).mockResolvedValueOnce(null);
    expect(await dao.getById('x')).toBeNull();
  });

  it('getByClient retorna resumen de ordenes', async () => {
    (mOrder.find as jest.Mock).mockResolvedValueOnce([orderDoc]);
    const result = await dao.getByClient('user-1');
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('order-1');
    expect(result[0].total).toBe(5000);
  });

  it('addItem agrega item y retorna el item creado', async () => {
    (mMenuItem.findOne as jest.Mock).mockResolvedValueOnce(menuItemDoc);
    (mOrder.findOneAndUpdate as jest.Mock).mockResolvedValueOnce(orderDoc);

    const result = await dao.addItem('order-1', {
      idItemMenu: 'item-1',
      cantidad: 1,
    });

    expect(result.idItemMenu).toBe('item-1');
    expect(result.precioUnidad).toBe(2500);
    expect(result.subtotal).toBe(2500);
    expect(mOrder.findOneAndUpdate).toHaveBeenCalledWith(
      { _id: 'order-1', deletedAt: null },
      { $push: { items: expect.any(Object) }, $inc: { total: 2500 } },
    );
  });

  it('addItem usa precio 0 si item de menu no existe', async () => {
    (mMenuItem.findOne as jest.Mock).mockResolvedValueOnce(null);
    (mOrder.findOneAndUpdate as jest.Mock).mockResolvedValueOnce(orderDoc);

    const result = await dao.addItem('order-1', { idItemMenu: 'x', cantidad: 2 });
    expect(result.precioUnidad).toBe(0);
    expect(result.subtotal).toBe(0);
  });

  it('updateStatus retorna el cambio de estado', async () => {
    const updated = { ...orderDoc, estado: 'confirmada' as const };
    (mOrder.findOneAndUpdate as jest.Mock).mockResolvedValueOnce(updated);
    const result = await dao.updateStatus('order-1', 'confirmada');
    expect(result?.estado).toBe('confirmada');
    expect(result?.id).toBe('order-1');
  });

  it('updateStatus retorna null si orden no existe', async () => {
    (mOrder.findOneAndUpdate as jest.Mock).mockResolvedValueOnce(null);
    expect(await dao.updateStatus('x', 'cancelada')).toBeNull();
  });
});
