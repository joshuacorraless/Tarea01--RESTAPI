import { Request, Response } from 'express';
import { registerUser, loginUser } from '../services/auth.service';
import { sendSuccess, sendError } from '../utils/response';

export async function register(req: Request, res: Response): Promise<void> {
  try {
    const user = await registerUser(req.body);
    sendSuccess(res, user, 'user registered successfully', 201);
  } catch (error: any) {
    if (error.response?.status === 409) {
      sendError(res, 'user with this email already exists', 409);
      return;
    }
    sendError(res, error.message || 'registration failed', 500);
  }
}

export async function login(req: Request, res: Response): Promise<void> {
  try {
    const tokens = await loginUser(req.body);
    sendSuccess(res, tokens, 'login successful');
  } catch (error: any) {
    if (error.response?.status === 401) {
      sendError(res, 'invalid email or password', 401);
      return;
    }
    sendError(res, error.message || 'login failed', 500);
  }
}
