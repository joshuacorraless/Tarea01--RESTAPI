import {
  CreateMenuInput,
  UpdateMenuInput,
} from '../../schemas/menu-reservation-order.schema';
import { IMenuDao, MenuRecord } from '../interfaces/IMenuDao';
import { MenuDocument, MenuModel } from './models/MenuModel';

function mapMenu(doc: MenuDocument): MenuRecord {
  return {
    id: doc._id,
    idRestaurante: doc.idRestaurante,
    nombre: doc.nombre,
    detalles: doc.detalles,
    activo: doc.activo,
    creadoEn: doc.creadoEn,
    ultimaActualizacion: doc.ultimaActualizacion,
  };
}

export class MongoMenuDao implements IMenuDao {
  async create(input: CreateMenuInput): Promise<MenuRecord> {
    const doc = await MenuModel.create({
      idRestaurante: input.idRestaurante,
      nombre: input.nombre,
      detalles: input.detalles,
      activo: input.activo ?? true,
    });
    return mapMenu(doc);
  }

  async getById(id: string): Promise<MenuRecord | null> {
    const doc = await MenuModel.findOne({ _id: id, deletedAt: null });
    if (!doc) return null;
    return mapMenu(doc);
  }

  async getByRestaurant(restaurantId: string): Promise<MenuRecord[]> {
    const docs = await MenuModel.find({ idRestaurante: restaurantId, deletedAt: null });
    return docs.map(mapMenu);
  }

  async update(id: string, input: UpdateMenuInput): Promise<MenuRecord | null> {
    const updates: Partial<MenuDocument> = {};
    if (input.nombre !== undefined) updates.nombre = input.nombre;
    if (input.detalles !== undefined) updates.detalles = input.detalles;
    if (input.activo !== undefined) updates.activo = input.activo;

    const doc = await MenuModel.findOneAndUpdate(
      { _id: id, deletedAt: null },
      { $set: updates },
      { new: true },
    );
    if (!doc) return null;
    return mapMenu(doc);
  }

  async softDelete(id: string): Promise<void> {
    await MenuModel.findOneAndUpdate(
      { _id: id, deletedAt: null },
      { $set: { deletedAt: new Date() } },
    );
  }
}
