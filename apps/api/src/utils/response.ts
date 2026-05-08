import { Response } from 'express';

interface ApiResponse<T = unknown> {
  success: boolean;
  message: string;
  data: T | null;
}

export function sendSuccess<T>(res: Response, data: T, message = 'ok', statusCode = 200): void {
  const body: ApiResponse<T> = {
    success: true,
    message,
    data,
  };
  res.status(statusCode).json(body);
}

export function sendError(res: Response, message: string, statusCode = 500): void {
  const body: ApiResponse<null> = {
    success: false,
    message,
    data: null,
  };
  res.status(statusCode).json(body);
}
