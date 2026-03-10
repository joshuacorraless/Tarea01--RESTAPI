import pool from "../config/database";
import {
  CreateOrderInput,
  AddOrderItemInput,
} from "../schemas/menu-reservation-order.schema";

export type EstadoOrden =
  | "pendiente"
  | "confirmada"
  | "en-preparacion"
  | "lista"
  | "entregada"
  | "cancelada";

// helpers

function mapOrder(row: any) {
  return {
    id: row.id,
    idRestaurante: row.idrestaurante,
    idClienteUsuario: row.idclienteusuario,
    idReserva: row.idreserva,
    tipoOrden: row.tipoorden,
    estado: row.estado,
    total: Number(row.total),
    notas: row.notas,
    creadoEn: row.creadoen,
    ultimaActualizacion: row.ultimaactualizacion,
    items: row.items ?? [],
  };
}

// ordenes
export async function createOrderService(
  input: CreateOrderInput & { idCliente: string },
) {
  // resolver el id local del cliente
  const clientResult = await pool.query(
    "SELECT * FROM sp_get_user_by_external_id($1)",
    [input.idCliente],
  );
  if (clientResult.rows.length === 0) {
    throw new Error("usuario de cliente no encontrado");
  }
  const clientUser = clientResult.rows[0];

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const orderResult = await client.query(
      "SELECT * FROM sp_create_order($1, $2, $3, $4::tipo_orden, $5)",
      [
        input.idRestaurante,
        clientUser.id,
        input.idReserva || null,
        input.tipoOrden ?? "en-restaurante",
        input.notas || null,
      ],
    );
    const order = orderResult.rows[0];

    for (const item of input.items) {
      await client.query("SELECT * FROM sp_add_order_item($1, $2, $3, $4)", [
        order.id,
        item.idItemMenu,
        item.cantidad,
        item.notas || null,
      ]);
    }

    await client.query("SELECT sp_recalculate_order_total($1)", [order.id]);

    const fullOrderResult = await client.query(
      "SELECT * FROM sp_get_order_by_id($1)",
      [order.id],
    );

    await client.query("COMMIT");
    return mapOrder(fullOrderResult.rows[0]);
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

export async function getOrderByIdService(id: string) {
  const result = await pool.query("SELECT * FROM sp_get_order_by_id($1)", [id]);
  if (result.rows.length === 0) return null;
  return mapOrder(result.rows[0]);
}

export async function getOrdersByClientService(externalId: string) {
  const clientResult = await pool.query(
    "SELECT * FROM sp_get_user_by_external_id($1)",
    [externalId],
  );
  if (clientResult.rows.length === 0) return [];
  const result = await pool.query("SELECT * FROM sp_get_orders_by_client($1)", [
    clientResult.rows[0].id,
  ]);
  return result.rows.map((row) => ({
    id: row.id,
    idRestaurante: row.idrestaurante,
    tipoOrden: row.tipoorden,
    estado: row.estado,
    total: Number(row.total),
    creadoEn: row.creadoen,
  }));
}

export async function addItemToOrderService(
  orderId: string,
  input: AddOrderItemInput,
) {
  const orderResult = await pool.query("SELECT * FROM sp_get_order_by_id($1)", [
    orderId,
  ]);
  if (orderResult.rows.length === 0) {
    throw new Error("orden no encontrada");
  }
  if (orderResult.rows[0].estado !== "pendiente") {
    throw new Error("solo puede agregar items a ordenes en estado pendientes");
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const itemResult = await client.query(
      "SELECT * FROM sp_add_order_item($1, $2, $3, $4)",
      [orderId, input.idItemMenu, input.cantidad, input.notas || null],
    );

    await client.query("SELECT sp_recalculate_order_total($1)", [orderId]);

    await client.query("COMMIT");
    return itemResult.rows[0];
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

export async function updateOrderStatusService(
  id: string,
  status: EstadoOrden,
) {
  const result = await pool.query(
    "SELECT * FROM sp_update_order_status($1, $2::estado_orden)",
    [id, status],
  );
  if (result.rows.length === 0) return null;
  const row = result.rows[0];
  return {
    id: row.id,
    estado: row.estado,
    ultimaActualizacion: row.ultimaactualizacion,
  };
}
