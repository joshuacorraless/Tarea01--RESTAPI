import pool from '../../config/database';
import { AddOrderItemInput } from '../../schemas/menu-reservation-order.schema';
import {
  CreateOrderData,
  EstadoOrden,
  IOrderDao,
  OrderRecord,
  OrderStatusChange,
  OrderSummaryRecord,
} from '../interfaces/IOrderDao';

function mapOrder(row: any): OrderRecord {
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

function mapOrderSummary(row: any): OrderSummaryRecord {
  return {
    id: row.id,
    idRestaurante: row.idrestaurante,
    tipoOrden: row.tipoorden,
    estado: row.estado,
    total: Number(row.total),
    creadoEn: row.creadoen,
  };
}

export class PostgresOrderDao implements IOrderDao {
  async createWithItems(data: CreateOrderData): Promise<OrderRecord> {
    // crear orden + items + recalcular total tiene que ser atomico
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const orderResult = await client.query(
        'SELECT * FROM sp_create_order($1, $2, $3, $4::tipo_orden, $5)',
        [
          data.idRestaurante,
          data.idClienteUsuario,
          data.idReserva || null,
          data.tipoOrden ?? 'en-restaurante',
          data.notas || null,
        ],
      );
      const order = orderResult.rows[0];

      for (const item of data.items) {
        await client.query('SELECT * FROM sp_add_order_item($1, $2, $3, $4)', [
          order.id,
          item.idItemMenu,
          item.cantidad,
          item.notas || null,
        ]);
      }

      await client.query('SELECT sp_recalculate_order_total($1)', [order.id]);

      const fullOrderResult = await client.query(
        'SELECT * FROM sp_get_order_by_id($1)',
        [order.id],
      );

      await client.query('COMMIT');
      return mapOrder(fullOrderResult.rows[0]);
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  async getById(id: string): Promise<OrderRecord | null> {
    const result = await pool.query('SELECT * FROM sp_get_order_by_id($1)', [id]);
    if (result.rows.length === 0) return null;
    return mapOrder(result.rows[0]);
  }

  async getByClient(clientId: string): Promise<OrderSummaryRecord[]> {
    const result = await pool.query(
      'SELECT * FROM sp_get_orders_by_client($1)',
      [clientId],
    );
    return result.rows.map(mapOrderSummary);
  }

  async addItem(orderId: string, input: AddOrderItemInput): Promise<any> {
    // tambien transaccional porque agregar item recalcula el total
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const itemResult = await client.query(
        'SELECT * FROM sp_add_order_item($1, $2, $3, $4)',
        [orderId, input.idItemMenu, input.cantidad, input.notas || null],
      );

      await client.query('SELECT sp_recalculate_order_total($1)', [orderId]);

      await client.query('COMMIT');
      return itemResult.rows[0];
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  async updateStatus(
    id: string,
    status: EstadoOrden,
  ): Promise<OrderStatusChange | null> {
    const result = await pool.query(
      'SELECT * FROM sp_update_order_status($1, $2::estado_orden)',
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
}
