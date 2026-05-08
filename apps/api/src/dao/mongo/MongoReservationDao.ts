import {
  CreateReservationData,
  IReservationDao,
  ReservationRecord,
  TableRecord,
} from '../interfaces/IReservationDao';
import { ReservationDocument, ReservationModel } from './models/ReservationModel';
import { TableModel } from './models/TableModel';

function mapReservation(doc: ReservationDocument): ReservationRecord {
  return {
    id: doc._id,
    idRestaurante: doc.idRestaurante,
    mesaId: doc.mesaId,
    idClienteUsuario: doc.idClienteUsuario,
    tamannoReserva: doc.tamannoReserva,
    reservadoPara: doc.reservadoPara,
    duracionReserva: doc.duracionReserva,
    estado: doc.estado,
    notas: doc.notas,
    creadoEn: doc.creadoEn,
    ultimaActualizacion: doc.ultimaActualizacion,
  };
}

export class MongoReservationDao implements IReservationDao {
  async getAvailableTables(
    restaurantId: string,
    reservadoPara: Date,
    duracion: number = 90,
  ): Promise<TableRecord[]> {
    const endTime = new Date(reservadoPara.getTime() + duracion * 60 * 1000);

    // dos intervalos se solapan si: inicio1 < fin2 AND inicio2 < fin1
    const busyTableIds = await ReservationModel.distinct('mesaId', {
      idRestaurante: restaurantId,
      estado: { $in: ['pendiente', 'confirmada'] },
      deletedAt: null,
      $expr: {
        $and: [
          { $lt: ['$reservadoPara', endTime] },
          {
            $gt: [
              { $add: ['$reservadoPara', { $multiply: ['$duracionReserva', 60000] }] },
              reservadoPara,
            ],
          },
        ],
      },
    });

    const tables = await TableModel.find({
      idRestaurante: restaurantId,
      disponible: true,
      _id: { $nin: busyTableIds },
    });

    return tables.map((t) => ({
      id: t._id,
      idRestaurante: t.idRestaurante,
      numeroMesa: t.numeroMesa,
      capacidad: t.capacidad,
      disponible: t.disponible,
    }));
  }

  async create(data: CreateReservationData): Promise<ReservationRecord> {
    const duracion = data.duracionReserva ?? 90;
    const endTime = new Date(data.reservadoPara.getTime() + duracion * 60 * 1000);

    // mismo criterio de solapamiento que getAvailableTables, pero acotado a la
    // mesa solicitada. Postgres lo hace dentro de sp_create_reservation.
    const conflict = await ReservationModel.findOne({
      idRestaurante: data.idRestaurante,
      mesaId: data.mesaId,
      estado: { $in: ['pendiente', 'confirmada'] },
      deletedAt: null,
      $expr: {
        $and: [
          { $lt: ['$reservadoPara', endTime] },
          {
            $gt: [
              { $add: ['$reservadoPara', { $multiply: ['$duracionReserva', 60000] }] },
              data.reservadoPara,
            ],
          },
        ],
      },
    });

    if (conflict) {
      throw new Error('mesa no disponible para el horario solicitado');
    }

    const doc = await ReservationModel.create({
      idRestaurante: data.idRestaurante,
      mesaId: data.mesaId,
      idClienteUsuario: data.idClienteUsuario,
      tamannoReserva: data.tamannoReserva,
      reservadoPara: data.reservadoPara,
      duracionReserva: duracion,
      notas: data.notas ?? null,
    });
    return mapReservation(doc);
  }

  async getById(id: string): Promise<ReservationRecord | null> {
    const doc = await ReservationModel.findOne({ _id: id, deletedAt: null });
    if (!doc) return null;
    return mapReservation(doc);
  }

  async getByClient(clientId: string): Promise<ReservationRecord[]> {
    const docs = await ReservationModel.find({
      idClienteUsuario: clientId,
      deletedAt: null,
    });
    return docs.map(mapReservation);
  }

  async getByRestaurant(restaurantId: string): Promise<ReservationRecord[]> {
    const docs = await ReservationModel.find({
      idRestaurante: restaurantId,
      deletedAt: null,
    });
    return docs.map(mapReservation);
  }

  async cancel(id: string, clientId: string): Promise<ReservationRecord | null> {
    // idRestaurante es la shard key; sin ella mongos abanica findAndModify a
    // todos los shards y MongoDB rechaza la operacion. Hacemos un read primero
    // (los reads sharded sí pueden hacer fan-out) para resolverla.
    const existing = await ReservationModel.findOne({ _id: id, deletedAt: null });
    if (!existing) return null;

    const doc = await ReservationModel.findOneAndUpdate(
      {
        _id: id,
        idRestaurante: existing.idRestaurante,
        idClienteUsuario: clientId,
        estado: { $nin: ['cancelada', 'completada'] },
        deletedAt: null,
      },
      { $set: { estado: 'cancelada' } },
      { new: true },
    );
    if (!doc) return null;
    return mapReservation(doc);
  }
}
