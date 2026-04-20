export interface ReservationRecord {
  id: string;
  idRestaurante: string;
  mesaId: string;
  idClienteUsuario: string;
  tamannoReserva: number;
  reservadoPara: Date;
  duracionReserva: number;
  estado: 'pendiente' | 'confirmada' | 'cancelada' | 'completada';
  notas: string | null;
  creadoEn: Date;
  ultimaActualizacion: Date;
}

export interface TableRecord {
  id: string;
  idRestaurante: string;
  numeroMesa: string | number;
  capacidad: number;
  disponible: boolean;
}

// data de creacion con idClienteUsuario ya resuelto por el service
// (el service mapea el externalAuthId al id local antes de invocar)
export interface CreateReservationData {
  idRestaurante: string;
  mesaId: string;
  idClienteUsuario: string;
  tamannoReserva: number;
  reservadoPara: Date;
  duracionReserva?: number;
  notas?: string | null;
}

export interface IReservationDao {
  getAvailableTables(
    restaurantId: string,
    reservadoPara: Date,
    duracion?: number,
  ): Promise<TableRecord[]>;
  create(data: CreateReservationData): Promise<ReservationRecord>;
  getById(id: string): Promise<ReservationRecord | null>;
  getByClient(clientId: string): Promise<ReservationRecord[]>;
  getByRestaurant(restaurantId: string): Promise<ReservationRecord[]>;
  cancel(id: string, clientId: string): Promise<ReservationRecord | null>;
}
