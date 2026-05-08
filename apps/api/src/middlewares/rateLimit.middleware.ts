import rateLimit from 'express-rate-limit';

// limite global para todo el trafico que entra a la api
export const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Demasiadas solicitudes desde esta IP, intente de nuevo mas tarde',
    data: null,
  },
});

// mas estricto para login: protege contra fuerza bruta de credenciales
export const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true,
  message: {
    success: false,
    message: 'Demasiados intentos de login fallidos, intente de nuevo en 15 minutos',
    data: null,
  },
});

// para escrituras (POST/PUT/DELETE/PATCH) en endpoints sensibles
export const sensitiveLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 50,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Demasiadas operaciones de escritura, intente de nuevo mas tarde',
    data: null,
  },
});
