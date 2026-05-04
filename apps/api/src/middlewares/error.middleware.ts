import { Request, Response, NextFunction } from 'express';
import { sendError } from '../utils/response';

export function errorHandler(err: Error, _req: Request, res: Response, _next: NextFunction): void {
  console.error(`[error] ${err.message}`, err.stack);
  sendError(res, err.message || 'internal server error', 500);
}
