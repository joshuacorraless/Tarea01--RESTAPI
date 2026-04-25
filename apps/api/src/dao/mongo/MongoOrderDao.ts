import { randomUUID } from 'crypto';
import { AddOrderItemInput } from '../../schemas/menu-reservation-order.schema';
import {
  CreateOrderData,
  EstadoOrden,
  IOrderDao,
  OrderRecord,
  OrderStatusChange,
  OrderSummaryRecord,
} from '../interfaces/IOrderDao';
import { MenuItemModel } from './models/MenuItemModel';
import { OrderDocument, OrderModel } from './models/OrderModel';

function mapOrder(doc: OrderDocument): OrderRecord {
  return {
    id: doc._id,
    idRestaurante: doc.idRestaurante,
    idClienteUsuario: doc.idClienteUsuario,
    idReserva: doc.idReserva,
    tipoOrden: doc.tipoOrden,
    estado: doc.estado,
    total: doc.total,
    notas: doc.notas,
    creadoEn: doc.creadoEn,
    ultimaActualizacion: doc.ultimaActualizacion,
    items: doc.items.map((item) => ({
      id: item._id,
      idItemMenu: item.idItemMenu,
      cantidad: item.cantidad,
      precioUnidad: item.precioUnidad,
      subtotal: item.subtotal,
      notas: item.notas,
    })),
  };
}

export class MongoOrderDao implements IOrderDao {
  async createWithItems(data: CreateOrderData): Promise<OrderRecord> {
    const itemIds = data.items.map((i) => i.idItemMenu);
    const menuItems = await MenuItemModel.find({
      _id: { $in: itemIds },
      deletedAt: null,
    });
    const priceMap = new Map(menuItems.map((mi) => [mi._id.toString(), mi.precio]));

    const orderItems = data.items.map((item) => {
      const precioUnidad = priceMap.get(item.idItemMenu) ?? 0;
      return {
        _id: randomUUID(),
        idItemMenu: item.idItemMenu,
        cantidad: item.cantidad,
        precioUnidad,
        subtotal: precioUnidad * item.cantidad,
        notas: item.notas ?? null,
      };
    });

    const total = orderItems.reduce((sum, i) => sum + i.subtotal, 0);

    const doc = await OrderModel.create({
      idRestaurante: data.idRestaurante,
      idClienteUsuario: data.idClienteUsuario,
      idReserva: data.idReserva ?? null,
      tipoOrden: data.tipoOrden ?? 'en-restaurante',
      notas: data.notas ?? null,
      items: orderItems,
      total,
    });

    return mapOrder(doc);
  }

  async getById(id: string): Promise<OrderRecord | null> {
    const doc = await OrderModel.findOne({ _id: id, deletedAt: null });
    if (!doc) return null;
    return mapOrder(doc);
  }

  async getByClient(clientId: string): Promise<OrderSummaryRecord[]> {
    const docs = await OrderModel.find(
      { idClienteUsuario: clientId, deletedAt: null },
      { idRestaurante: 1, tipoOrden: 1, estado: 1, total: 1, creadoEn: 1 },
    );
    return docs.map((doc) => ({
      id: doc._id,
      idRestaurante: doc.idRestaurante,
      tipoOrden: doc.tipoOrden,
      estado: doc.estado,
      total: doc.total,
      creadoEn: doc.creadoEn,
    }));
  }

  async addItem(orderId: string, input: AddOrderItemInput): Promise<any> {
    const menuItem = await MenuItemModel.findOne({ _id: input.idItemMenu, deletedAt: null });
    const precioUnidad = menuItem?.precio ?? 0;
    const subtotal = precioUnidad * input.cantidad;

    const newItem = {
      _id: randomUUID(),
      idItemMenu: input.idItemMenu,
      cantidad: input.cantidad,
      precioUnidad,
      subtotal,
      notas: input.notas ?? null,
    };

    await OrderModel.findOneAndUpdate(
      { _id: orderId, deletedAt: null },
      {
        $push: { items: newItem },
        $inc: { total: subtotal },
      },
    );

    return newItem;
  }

  async updateStatus(id: string, status: EstadoOrden): Promise<OrderStatusChange | null> {
    const doc = await OrderModel.findOneAndUpdate(
      { _id: id, deletedAt: null },
      { $set: { estado: status } },
      { new: true },
    );
    if (!doc) return null;
    return {
      id: doc._id,
      estado: doc.estado,
      ultimaActualizacion: doc.ultimaActualizacion,
    };
  }
}
