import { randomUUID } from 'crypto';
import mongoose, { HydratedDocument, Schema } from 'mongoose';

export interface ITable {
  _id: string;
  idRestaurante: string;
  numeroMesa: string | number;
  capacidad: number;
  disponible: boolean;
}

// los seeds y el resto del repo (init.ps1, ADR-003) usan la coleccion `mesas`,
// por defecto Mongoose pluralizaria 'Table' a 'tables' y no encontraria nada.
const tableSchema = new Schema<ITable>(
  {
    _id: { type: String, default: () => randomUUID() },
    idRestaurante: { type: String, required: true, index: true },
    numeroMesa: { type: Schema.Types.Mixed, required: true },
    capacidad: { type: Number, required: true },
    disponible: { type: Boolean, default: true },
  },
  { collection: 'mesas' },
);

export type TableDocument = HydratedDocument<ITable>;
export const TableModel = mongoose.model<ITable>('Table', tableSchema);
