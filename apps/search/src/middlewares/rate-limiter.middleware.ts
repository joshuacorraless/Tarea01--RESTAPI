import rateLimit from 'express-rate-limit';

// 100 requests por minuto por IP
export const searchLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 100,
  message: { error: 'Demasiadas solicitudes, intente más tarde' },
});