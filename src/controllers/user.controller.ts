import { Response } from 'express';
import { AuthenticatedRequest } from '../middlewares/auth.middleware';
import { getUserByExternalId, updateUser, softDeleteUser } from '../services/user.service';
import { sendSuccess, sendError } from '../utils/response';

export async function getMe(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const user = await getUserByExternalId(req.user!.sub);
    sendSuccess(res, user, 'user profile retrieved');
  } catch (error: any) {
    sendError(res, error.message, 404);
  }
}

export async function update(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const user = await updateUser(req.params.id, req.user!.sub, req.body);
    sendSuccess(res, user, 'user updated successfully');
  } catch (error: any) {
    const statusCode = error.message.includes('forbidden') ? 403 : 404;
    sendError(res, error.message, statusCode);
  }
}

export async function remove(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    await softDeleteUser(req.params.id, req.user!.sub);
    sendSuccess(res, null, 'user deleted successfully');
  } catch (error: any) {
    const statusCode = error.message.includes('forbidden') ? 403 : 404;
    sendError(res, error.message, statusCode);
  }
}
