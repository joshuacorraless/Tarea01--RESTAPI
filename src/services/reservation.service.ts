import { dao } from '../dao/DaoFactory';
import { CreateReservationInput } from '../schemas/menu-reservation-order.schema';

// reservas
export async function getAvailableTablesService(
  restaurantId: string,
  reservadoPara: Date,
  duracion: number = 90,
) {
  return dao.reservations.getAvailableTables(restaurantId, reservadoPara, duracion);
}

export async function createReservationService(
  input: CreateReservationInput & { idCliente: string },
) {
  // mapear externalAuthId (sub de keycloak) al id local antes de crear la reserva
  const clientUser = await dao.users.getByExternalId(input.idCliente);
  if (!clientUser) {
    throw new Error('Usuario cliente no encontrado');
  }

  return dao.reservations.create({
    idRestaurante: input.idRestaurante,
    mesaId: input.mesaId,
    idClienteUsuario: clientUser.id,
    tamannoReserva: input.tamannoReserva,
    reservadoPara: new Date(input.reservadoPara),
    duracionReserva: input.duracionReserva ?? 90,
    notas: input.notas || null,
  });
}

export async function getReservationByIdService(id: string) {
  return dao.reservations.getById(id);
}

export async function getReservationsByClientService(externalId: string) {
  const clientUser = await dao.users.getByExternalId(externalId);
  if (!clientUser) return [];
  return dao.reservations.getByClient(clientUser.id);
}

export async function getReservationsByRestaurantService(restaurantId: string) {
  return dao.reservations.getByRestaurant(restaurantId);
}

export async function cancelReservationService(id: string, externalId: string) {
  const clientUser = await dao.users.getByExternalId(externalId);
  if (!clientUser) return null;
  return dao.reservations.cancel(id, clientUser.id);
}
