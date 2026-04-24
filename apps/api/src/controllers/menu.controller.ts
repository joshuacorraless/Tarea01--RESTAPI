import { Response } from 'express';
import { AuthenticatedRequest } from '../middlewares/auth.middleware';
import {
  createMenuService,
  getMenuByIdService,
  getMenusByRestaurantService,
  updateMenuService,
  deleteMenuService,
  createMenuItemService,
  getMenuItemsService,
  updateMenuItemService,
  deleteMenuItemService,
} from '../services/menu.service';
import { sendSuccess, sendError } from '../utils/response';

// menus

export async function createMenu(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const menu = await createMenuService(req.body);
    sendSuccess(res, menu, 'menu creado exitosamente', 201);
  } catch (error: any) {
    sendError(res, error.message, 500);
  }
}

export async function getMenuById(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const menu = await getMenuByIdService(req.params.id);
    if (!menu) {
      sendError(res, 'menu no encontrado', 404);
      return;
    }
    sendSuccess(res, menu, 'menu encontrado');
  } catch (error: any) {
    sendError(res, error.message, 500);
  }
}

export async function getMenusByRestaurant(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const menus = await getMenusByRestaurantService(req.params.restaurantId);
    sendSuccess(res, menus, 'menus encontrados');
  } catch (error: any) {
    sendError(res, error.message, 500);
  }
}

export async function updateMenu(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const menu = await updateMenuService(req.params.id, req.body);
    if (!menu) {
      sendError(res, 'menu no encontrado', 404);
      return;
    }
    sendSuccess(res, menu, 'menu actualizado ');
  } catch (error: any) {
    sendError(res, error.message, 500);
  }
}

export async function deleteMenu(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    await deleteMenuService(req.params.id);
    sendSuccess(res, null, 'menu eliminado exitosamente');
  } catch (error: any) {
    sendError(res, error.message, 500);
  }
}

// items del menu

export async function createMenuItem(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const item = await createMenuItemService(req.params.menuId, req.body);
    sendSuccess(res, item, 'item del menu creado exitosamente', 201);
  } catch (error: any) {
    sendError(res, error.message, 500);
  }
}

export async function getMenuItems(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const items = await getMenuItemsService(req.params.menuId);
    sendSuccess(res, items, 'item del menu encontrado');
  } catch (error: any) {
    sendError(res, error.message, 500);
  }
}

export async function updateMenuItem(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const item = await updateMenuItemService(req.params.itemId, req.body);
    if (!item) {
      sendError(res, 'item del menu no encontrado', 404);
      return;
    }
    sendSuccess(res, item, 'item del menu actualizado exitosamente');
  } catch (error: any) {
    sendError(res, error.message, 500);
  }
}

export async function deleteMenuItem(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    await deleteMenuItemService(req.params.itemId);
    sendSuccess(res, null, 'item del menu eliminado exitosamente');
  } catch (error: any) {
    sendError(res, error.message, 500);
  }
}