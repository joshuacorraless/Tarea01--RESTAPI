import { dao } from '../dao/DaoFactory';
import {
  AddOrderItemInput,
  CreateOrderInput,
} from '../schemas/menu-reservation-order.schema';

export type EstadoOrden =
  | 'pendiente'
  | 'confirmada'
  | 'en-preparacion'
  | 'lista'
  | 'entregada'
  | 'cancelada';

export async function createOrderService(
  input: CreateOrderInput & { idCliente: string },
) {
  const clientUser = await dao.users.getByExternalId(input.idCliente);
  if (!clientUser) {
    throw new Error('usuario de cliente no encontrado');
  }

  return dao.orders.createWithItems({
    idRestaurante: input.idRestaurante,
    idClienteUsuario: clientUser.id,
    idReserva: input.idReserva || null,
    tipoOrden: input.tipoOrden ?? 'en-restaurante',
    notas: input.notas || null,
    items: input.items,
  });
}

export async function getOrderByIdService(id: string) {
  return dao.orders.getById(id);
}

export async function getOrdersByClientService(externalId: string) {
  const clientUser = await dao.users.getByExternalId(externalId);
  if (!clientUser) return [];
  return dao.orders.getByClient(clientUser.id);
}

export async function addItemToOrderService(
  orderId: string,
  input: AddOrderItemInput,
) {
  const order = await dao.orders.getById(orderId);
  if (!order) {
    throw new Error('orden no encontrada');
  }
  if (order.estado !== 'pendiente') {
    throw new Error('solo puede agregar items a ordenes en estado pendientes');
  }

  return dao.orders.addItem(orderId, input);
}

export async function updateOrderStatusService(
  id: string,
  status: EstadoOrden,
) {
  return dao.orders.updateStatus(id, status);
}
