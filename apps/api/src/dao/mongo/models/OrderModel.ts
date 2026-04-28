import { randomUUID } from 'crypto';
import mongoose, { HydratedDocument, Schema } from 'mongoose';
import { EstadoOrden, TipoOrden } from '../../interfaces/IOrderDao';

export interface IOrderItem {
  _id: string;
  idItemMenu: string;
  cantidad: number;
  precioUnidad: number;
  subtotal: number;
  notas: string | null;
}

export interface IOrder {
  _id: string;
  idRestaurante: string;
  idClienteUsuario: string;
  idReserva: string | null;
  tipoOrden: TipoOrden;
  estado: EstadoOrden;
  total: number;
  notas: string | null;
  items: IOrderItem[];
  deletedAt: Date | null;
  creadoEn: Date;
  ultimaActualizacion: Date;
}

const orderItemSchema = new Schema<IOrderItem>({
  _id: { type: String, default: () => randomUUID() },
  idItemMenu: { type: String, required: true },
  cantidad: { type: Number, required: true },
  precioUnidad: { type: Number, required: true },
  subtotal: { type: Number, required: true },
  notas: { type: String, default: null },
});

const orderSchema = new Schema<IOrder>(
  {
    _id: { type: String, default: () => randomUUID() },
    idRestaurante: { type: String, required: true },
    idClienteUsuario: { type: String, required: true },
    idReserva: { type: String, default: null },
    tipoOrden: {
      type: String,
      enum: ['en-restaurante', 'para-llevar'],
      default: 'en-restaurante',
    },
    estado: {
      type: String,
      enum: ['pendiente', 'confirmada', 'en-preparacion', 'lista', 'entregada', 'cancelada'],
      default: 'pendiente',
    },
    total: { type: Number, default: 0 },
    notas: { type: String, default: null },
    items: [orderItemSchema],
    deletedAt: { type: Date, default: null },
  },
  { timestamps: { createdAt: 'creadoEn', updatedAt: 'ultimaActualizacion' } },
);

export type OrderDocument = HydratedDocument<IOrder>;
export const OrderModel = mongoose.model<IOrder>('Order', orderSchema);
