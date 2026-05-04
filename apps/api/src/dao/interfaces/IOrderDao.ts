import { AddOrderItemInput } from '../../schemas/menu-reservation-order.schema';

export type EstadoOrden =
  | 'pendiente'
  | 'confirmada'
  | 'en-preparacion'
  | 'lista'
  | 'entregada'
  | 'cancelada';

export type TipoOrden = 'en-restaurante' | 'para-llevar';

export interface OrderItemSummary {
  id: string;
  idItemMenu: string;
  cantidad: number;
  precioUnidad: number;
  subtotal: number;
  notas: string | null;
}

export interface OrderRecord {
  id: string;
  idRestaurante: string;
  idClienteUsuario: string;
  idReserva: string | null;
  tipoOrden: TipoOrden;
  estado: EstadoOrden;
  total: number;
  notas: string | null;
  creadoEn: Date;
  ultimaActualizacion: Date;
  items: OrderItemSummary[];
}

// vista reducida para "mis ordenes"
export interface OrderSummaryRecord {
  id: string;
  idRestaurante: string;
  tipoOrden: TipoOrden;
  estado: EstadoOrden;
  total: number;
  creadoEn: Date;
}

export interface OrderStatusChange {
  id: string;
  estado: EstadoOrden;
  ultimaActualizacion: Date;
}

export interface CreateOrderData {
  idRestaurante: string;
  idClienteUsuario: string;
  idReserva?: string | null;
  tipoOrden?: TipoOrden;
  notas?: string | null;
  items: Array<{
    idItemMenu: string;
    cantidad: number;
    notas?: string | null;
  }>;
}

// la transaccion (begin/commit) la maneja el dao porque crear o agregar items
// necesita mas de un sp dentro del mismo bloque atomico
export interface IOrderDao {
  createWithItems(data: CreateOrderData): Promise<OrderRecord>;
  getById(id: string): Promise<OrderRecord | null>;
  getByClient(clientId: string): Promise<OrderSummaryRecord[]>;
  addItem(orderId: string, input: AddOrderItemInput): Promise<any>;
  updateStatus(id: string, status: EstadoOrden): Promise<OrderStatusChange | null>;
}
