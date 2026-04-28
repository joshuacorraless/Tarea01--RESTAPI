import { randomUUID } from 'crypto';
import mongoose, { HydratedDocument, Schema } from 'mongoose';

export interface ITable {
  _id: string;
  idRestaurante: string;
  numeroMesa: string | number;
  capacidad: number;
  disponible: boolean;
}

const tableSchema = new Schema<ITable>({
  _id: { type: String, default: () => randomUUID() },
  idRestaurante: { type: String, required: true, index: true },
  numeroMesa: { type: Schema.Types.Mixed, required: true },
  capacidad: { type: Number, required: true },
  disponible: { type: Boolean, default: true },
});

export type TableDocument = HydratedDocument<ITable>;
export const TableModel = mongoose.model<ITable>('Table', tableSchema);
