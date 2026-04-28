import { dao } from '../dao/DaoFactory';
import { MenuItemRecord } from '../dao/interfaces/IMenuItemDao';
import {
  CreateMenuInput,
  CreateMenuItemInput,
  UpdateMenuInput,
  UpdateMenuItemInput,
} from '../schemas/menu-reservation-order.schema';

// menus

export async function createMenuService(input: CreateMenuInput) {
  return dao.menus.create(input);
}

export async function getMenuByIdService(id: string) {
  return dao.menus.getById(id);
}

export async function getMenusByRestaurantService(restaurantId: string) {
  return dao.menus.getByRestaurant(restaurantId);
}

export async function updateMenuService(id: string, input: UpdateMenuInput) {
  return dao.menus.update(id, input);
}

export async function deleteMenuService(id: string): Promise<void> {
  await dao.menus.softDelete(id);
}

// items del menu

export async function createMenuItemService(menuId: string, input: CreateMenuItemInput) {
  return dao.menuItems.create(menuId, input);
}

export async function getMenuItemsService(menuId: string) {
  return dao.menuItems.getByMenu(menuId);
}

export async function getAllMenuItemsService(): Promise<MenuItemRecord[]> {
  return dao.menuItems.findAll();
}

export async function updateMenuItemService(itemId: string, input: UpdateMenuItemInput) {
  return dao.menuItems.update(itemId, input);
}

export async function deleteMenuItemService(itemId: string): Promise<void> {
  await dao.menuItems.softDelete(itemId);
}
