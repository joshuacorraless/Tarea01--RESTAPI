import { Request, Response, NextFunction } from 'express';
import { ZodSchema } from 'zod';
import { sendError } from '../utils/response';

export function validate(schema: ZodSchema) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req.body);

    if (!result.success) {
      const errors = result.error.flatten().fieldErrors;
      sendError(res, JSON.stringify(errors), 400);
      return;
    }

    // sobrescribir el body con la version parseada (sin campos extra)
    req.body = result.data;
    next();
  };
}
