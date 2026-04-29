import {
  CreateMenuItemInput,
  UpdateMenuItemInput,
} from "../../schemas/menu-reservation-order.schema";
import { IMenuItemDao, MenuItemRecord } from "../interfaces/IMenuItemDao";
import { MenuItemDocument, MenuItemModel } from "./models/MenuItemModel";

function mapMenuItem(doc: MenuItemDocument): MenuItemRecord {
  return {
    id: doc._id,
    idMenu: doc.idMenu,
    nombre: doc.nombre,
    detalles: doc.detalles,
    categoria: doc.categoria,
    precio: doc.precio,
    imagen: doc.imagen,
    disponible: doc.disponible,
    creadoEn: doc.creadoEn,
    ultimaActualizacion: doc.ultimaActualizacion,
  };
}

export class MongoMenuItemDao implements IMenuItemDao {
  async create(
    menuId: string,
    input: CreateMenuItemInput,
  ): Promise<MenuItemRecord> {
    const doc = await MenuItemModel.create({
      idMenu: menuId,
      nombre: input.nombre,
      detalles: input.detalles,
      categoria: input.categoria ?? "General",
      precio: input.precio,
      imagen: input.imagen ?? null,
      disponible: input.disponible ?? true,
    });
    return mapMenuItem(doc);
  }

  async getByMenu(menuId: string): Promise<MenuItemRecord[]> {
    const docs = await MenuItemModel.find({ idMenu: menuId, deletedAt: null });
    return docs.map(mapMenuItem);
  }

  async findAll(): Promise<MenuItemRecord[]> {
    const docs = await MenuItemModel.aggregate([
      { $match: { deletedAt: null } },
      // join con menus para obtener restaurantId
      {
        $lookup: {
          from: "menus",
          localField: "idMenu",
          foreignField: "_id",
          as: "menu",
        },
      },
      { $unwind: "$menu" },
      { $match: { "menu.deletedAt": null } },
      {
        $project: {
          _id: 1,
          idMenu: 1,
          restaurantId: "$menu.idRestaurante",
          nombre: 1,
          categoria: 1,
          detalles: 1,
          precio: 1,
          imagen: 1,
          disponible: 1,
          creadoEn: 1,
          ultimaActualizacion: 1,
        },
      },
    ]);

    return docs.map((doc) => ({
      id: doc._id,
      idMenu: doc.idMenu,
      restaurantId: doc.restaurantId,
      nombre: doc.nombre,
      detalles: doc.detalles,
      categoria: doc.categoria,
      precio: doc.precio,
      imagen: doc.imagen,
      disponible: doc.disponible,
      creadoEn: doc.creadoEn,
      ultimaActualizacion: doc.ultimaActualizacion,
    }));
  }

  async update(
    itemId: string,
    input: UpdateMenuItemInput,
  ): Promise<MenuItemRecord | null> {
    const updates: Partial<MenuItemDocument> = {};
    if (input.nombre !== undefined) updates.nombre = input.nombre;
    if (input.detalles !== undefined) updates.detalles = input.detalles;
    if (input.categoria !== undefined) updates.categoria = input.categoria;
    if (input.precio !== undefined) updates.precio = input.precio;
    if (input.imagen !== undefined) updates.imagen = input.imagen ?? null;
    if (input.disponible !== undefined) updates.disponible = input.disponible;

    const doc = await MenuItemModel.findOneAndUpdate(
      { _id: itemId, deletedAt: null },
      { $set: updates },
      { new: true },
    );
    if (!doc) return null;
    return mapMenuItem(doc);
  }

  async softDelete(itemId: string): Promise<void> {
    await MenuItemModel.findOneAndUpdate(
      { _id: itemId, deletedAt: null },
      { $set: { deletedAt: new Date() } },
    );
  }
}
