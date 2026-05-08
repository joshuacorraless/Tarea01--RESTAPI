import { randomUUID } from 'crypto';
import mongoose, { HydratedDocument, Schema } from 'mongoose';

export interface IReservation {
  _id: string;
  // shard key: la mayoria de queries filtran por restaurante
  idRestaurante: string;
  mesaId: string;
  idClienteUsuario: string;
  tamannoReserva: number;
  reservadoPara: Date;
  duracionReserva: number;
  estado: 'pendiente' | 'confirmada' | 'cancelada' | 'completada';
  notas: string | null;
  deletedAt: Date | null;
  creadoEn: Date;
  ultimaActualizacion: Date;
}

const reservationSchema = new Schema<IReservation>(
  {
    _id: { type: String, default: () => randomUUID() },
    idRestaurante: { type: String, required: true, index: true },
    mesaId: { type: String, required: true },
    idClienteUsuario: { type: String, required: true, index: true },
    tamannoReserva: { type: Number, required: true },
    reservadoPara: { type: Date, required: true },
    duracionReserva: { type: Number, default: 90 },
    estado: {
      type: String,
      enum: ['pendiente', 'confirmada', 'cancelada', 'completada'],
      default: 'pendiente',
    },
    notas: { type: String, default: null },
    deletedAt: { type: Date, default: null },
  },
  { timestamps: { createdAt: 'creadoEn', updatedAt: 'ultimaActualizacion' } },
);

export type ReservationDocument = HydratedDocument<IReservation>;
export const ReservationModel = mongoose.model<IReservation>('Reservation', reservationSchema);
