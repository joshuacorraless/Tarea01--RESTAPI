import rateLimit from 'express-rate-limit';

export const searchLimiter = rateLimit({
  windowMs: 60 * 1000, // ventana de 1 minuto
  max: 100,            // máximo 100 requests por minuto por IP
  message: { error: 'Demasiadas solicitudes, intente más tarde' },
});