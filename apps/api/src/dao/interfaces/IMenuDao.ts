import {
  CreateMenuInput,
  UpdateMenuInput,
} from '../../schemas/menu-reservation-order.schema';

export interface MenuRecord {
  id: string;
  idRestaurante: string;
  nombre: string;
  detalles: string;
  activo: boolean;
  creadoEn: Date;
  ultimaActualizacion: Date;
}

export interface IMenuDao {
  create(input: CreateMenuInput): Promise<MenuRecord>;
  getById(id: string): Promise<MenuRecord | null>;
  getByRestaurant(restaurantId: string): Promise<MenuRecord[]>;
  update(id: string, input: UpdateMenuInput): Promise<MenuRecord | null>;
  softDelete(id: string): Promise<void>;
}
