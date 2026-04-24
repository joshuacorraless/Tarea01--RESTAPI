import { Request, Response, NextFunction } from 'express';
import { ZodSchema } from 'zod';
import { sendError } from '../utils/response';

// middleware generico que valida req.body contra un schema zod
export function validate(schema: ZodSchema) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req.body);

    if (!result.success) {
      const errors = result.error.flatten().fieldErrors;
      sendError(res, JSON.stringify(errors), 400);
      return;
    }

    // reemplaza body con datos parseados y limpios (sin campos extra)
    req.body = result.data;
    next();
  };
}
