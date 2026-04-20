import pool from '../../config/database';
import {
  CreateReservationData,
  IReservationDao,
  ReservationRecord,
  TableRecord,
} from '../interfaces/IReservationDao';

function mapReservation(row: any): ReservationRecord {
  return {
    id: row.id,
    idRestaurante: row.idrestaurante,
    mesaId: row.mesaid,
    idClienteUsuario: row.idclienteusuario,
    tamannoReserva: row.tamannoreserva,
    reservadoPara: row.reservadopara,
    duracionReserva: row.duracionreserva,
    estado: row.estado,
    notas: row.notas,
    creadoEn: row.creadoen,
    ultimaActualizacion: row.ultimaactualizacion,
  };
}

function mapTable(row: any): TableRecord {
  return {
    id: row.id,
    idRestaurante: row.idrestaurante,
    numeroMesa: row.numeromesa,
    capacidad: row.capacidad,
    disponible: row.disponible,
  };
}

export class PostgresReservationDao implements IReservationDao {
  async getAvailableTables(
    restaurantId: string,
    reservadoPara: Date,
    duracion: number = 90,
  ): Promise<TableRecord[]> {
    const result = await pool.query(
      'SELECT * FROM sp_get_available_tables($1, $2, $3)',
      [restaurantId, reservadoPara, duracion],
    );
    return result.rows.map(mapTable);
  }

  async create(data: CreateReservationData): Promise<ReservationRecord> {
    const result = await pool.query(
      'SELECT * FROM sp_create_reservation($1, $2, $3, $4, $5, $6, $7)',
      [
        data.idRestaurante,
        data.mesaId,
        data.idClienteUsuario,
        data.tamannoReserva,
        data.reservadoPara,
        data.duracionReserva ?? 90,
        data.notas ?? null,
      ],
    );
    return mapReservation(result.rows[0]);
  }

  async getById(id: string): Promise<ReservationRecord | null> {
    const result = await pool.query(
      'SELECT * FROM sp_get_reservation_by_id($1)',
      [id],
    );
    if (result.rows.length === 0) return null;
    return mapReservation(result.rows[0]);
  }

  async getByClient(clientId: string): Promise<ReservationRecord[]> {
    const result = await pool.query(
      'SELECT * FROM sp_get_reservations_by_client($1)',
      [clientId],
    );
    return result.rows.map(mapReservation);
  }

  async getByRestaurant(restaurantId: string): Promise<ReservationRecord[]> {
    const result = await pool.query(
      'SELECT * FROM sp_get_reservations_by_restaurant($1)',
      [restaurantId],
    );
    return result.rows.map(mapReservation);
  }

  async cancel(
    id: string,
    clientId: string,
  ): Promise<ReservationRecord | null> {
    const result = await pool.query(
      'SELECT * FROM sp_cancel_reservation($1, $2)',
      [id, clientId],
    );
    if (result.rows.length === 0) return null;
    return mapReservation(result.rows[0]);
  }
}
