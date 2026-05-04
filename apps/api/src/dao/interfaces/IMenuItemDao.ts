import {
  CreateMenuItemInput,
  UpdateMenuItemInput,
} from '../../schemas/menu-reservation-order.schema';

export interface MenuItemRecord {
  id: string;
  idMenu: string;
  restaurantId?: string;
  nombre: string;
  detalles: string;
  // categoria va indexada porque la usa el microservicio de busqueda
  categoria: string;
  precio: number;
  imagen: string | null;
  disponible: boolean;
  creadoEn: Date;
  ultimaActualizacion: Date;
}

export interface IMenuItemDao {
  create(menuId: string, input: CreateMenuItemInput): Promise<MenuItemRecord>;
  getByMenu(menuId: string): Promise<MenuItemRecord[]>;
  findAll(): Promise<MenuItemRecord[]>;
  update(itemId: string, input: UpdateMenuItemInput): Promise<MenuItemRecord | null>;
  softDelete(itemId: string): Promise<void>;
}
