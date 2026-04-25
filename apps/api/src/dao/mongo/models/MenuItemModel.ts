import { randomUUID } from 'crypto';
import mongoose, { HydratedDocument, Schema } from 'mongoose';

export interface IMenuItem {
  _id: string;
  idMenu: string;
  nombre: string;
  detalles: string;
  // indexado para busqueda por categoria (ElasticSearch fase 5) y shard key candidata
  categoria: string;
  precio: number;
  imagen: string | null;
  disponible: boolean;
  deletedAt: Date | null;
  creadoEn: Date;
  ultimaActualizacion: Date;
}

const menuItemSchema = new Schema<IMenuItem>(
  {
    _id: { type: String, default: () => randomUUID() },
    idMenu: { type: String, required: true, index: true },
    nombre: { type: String, required: true },
    detalles: { type: String, required: true },
    categoria: { type: String, required: true, default: 'General', index: true },
    precio: { type: Number, required: true },
    imagen: { type: String, default: null },
    disponible: { type: Boolean, default: true },
    deletedAt: { type: Date, default: null },
  },
  { timestamps: { createdAt: 'creadoEn', updatedAt: 'ultimaActualizacion' } },
);

export type MenuItemDocument = HydratedDocument<IMenuItem>;
export const MenuItemModel = mongoose.model<IMenuItem>('MenuItem', menuItemSchema);
