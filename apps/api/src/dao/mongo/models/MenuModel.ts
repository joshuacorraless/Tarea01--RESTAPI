import { randomUUID } from 'crypto';
import mongoose, { HydratedDocument, Schema } from 'mongoose';

export interface IMenu {
  _id: string;
  idRestaurante: string;
  nombre: string;
  detalles: string;
  activo: boolean;
  deletedAt: Date | null;
  creadoEn: Date;
  ultimaActualizacion: Date;
}

const menuSchema = new Schema<IMenu>(
  {
    _id: { type: String, default: () => randomUUID() },
    idRestaurante: { type: String, required: true, index: true },
    nombre: { type: String, required: true },
    detalles: { type: String, required: true },
    activo: { type: Boolean, default: true },
    deletedAt: { type: Date, default: null },
  },
  { timestamps: { createdAt: 'creadoEn', updatedAt: 'ultimaActualizacion' } },
);

export type MenuDocument = HydratedDocument<IMenu>;
export const MenuModel = mongoose.model<IMenu>('Menu', menuSchema);
