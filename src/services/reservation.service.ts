import pool from "../config/database";
import { CreateReservationInput } from "../schemas/menu-reservation-order.schema";

// helpers
function mapReservation(row: any) {
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

function mapTable(row: any) {
  return {
    id: row.id,
    idRestaurante: row.idrestaurante,
    numeroMesa: row.numeromesa,
    capacidad: row.capacidad,
    disponible: row.disponible,
  };
}

// reservas
export async function getAvailableTablesService(
  restaurantId: string,
  reservadoPara: Date,
  duracion: number = 90,
) {
  const result = await pool.query(
    "SELECT * FROM sp_get_available_tables($1, $2, $3)",
    [restaurantId, reservadoPara, duracion],
  );
  return result.rows.map(mapTable);
}

export async function createReservationService(
  input: CreateReservationInput & { idCliente: string },
) {
  // buscar el usuario local por su external_auth_id (sub de keycloak)
  const clientResult = await pool.query(
    "SELECT * FROM sp_get_user_by_external_id($1)",
    [input.idCliente],
  );
  if (clientResult.rows.length === 0) {
    throw new Error("Usuario cliente no encontrado");
  }
  const clientUser = clientResult.rows[0];

  const result = await pool.query(
    "SELECT * FROM sp_create_reservation($1, $2, $3, $4, $5, $6, $7)",
    [
      input.idRestaurante,
      input.mesaId,
      clientUser.id,
      input.tamannoReserva,
      new Date(input.reservadoPara),
      input.duracionReserva ?? 90,
      input.notas || null,
    ],
  );
  return mapReservation(result.rows[0]);
}

export async function getReservationByIdService(id: string) {
  const result = await pool.query(
    "SELECT * FROM sp_get_reservation_by_id($1)",
    [id],
  );
  if (result.rows.length === 0) return null;
  return mapReservation(result.rows[0]);
}

export async function getReservationsByClientService(externalId: string) {
  // resolver el id local primero
  const clientResult = await pool.query(
    "SELECT * FROM sp_get_user_by_external_id($1)",
    [externalId],
  );
  if (clientResult.rows.length === 0) return [];
  const result = await pool.query(
    "SELECT * FROM sp_get_reservations_by_client($1)",
    [clientResult.rows[0].id],
  );
  return result.rows.map(mapReservation);
}

export async function getReservationsByRestaurantService(restaurantId: string) {
  const result = await pool.query(
    "SELECT * FROM sp_get_reservations_by_restaurant($1)",
    [restaurantId],
  );
  return result.rows.map(mapReservation);
}

export async function cancelReservationService(id: string, externalId: string) {
  // resolver el id local
  const clientResult = await pool.query(
    "SELECT * FROM sp_get_user_by_external_id($1)",
    [externalId],
  );
  if (clientResult.rows.length === 0) return null;
  const result = await pool.query(
    "SELECT * FROM sp_cancel_reservation($1, $2)",
    [id, clientResult.rows[0].id],
  );
  if (result.rows.length === 0) return null;
  return mapReservation(result.rows[0]);
}
