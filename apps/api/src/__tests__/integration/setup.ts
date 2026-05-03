// setup.ts — configuración compartida para todos los tests de integración.
//
// ¿Qué hace este archivo?
// Centraliza los mocks de todas las dependencias externas (BD, Redis, Keycloak)
// para que cada test de integración no tenga que repetirlos.
// También exporta la instancia de supertest lista para usar.
//
// ¿Qué mockeamos y por qué?
//   - pool (PostgreSQL): no tenemos BD real en CI
//   - redis config: no tenemos Redis real en CI
//   - keycloak/jwks: no podemos verificar JWT reales en tests
//   - auth.middleware: reemplazamos la validación JWT por una función
//     que simplemente inyecta req.user con datos de prueba

import request from 'supertest';
import app from '../../app';

// ─── Mock: PostgreSQL ────────────────────────────────────────────────────────
// Todos los tests que necesiten resultados específicos de BD hacen:
//   (mockedPool.query as jest.Mock).mockResolvedValueOnce({ rows: [...] })
jest.mock('../../config/database', () => ({
  query: jest.fn(),
  connect: jest.fn(),
}));

// ─── Mock: Redis ─────────────────────────────────────────────────────────────
// Devolvemos null siempre → el cacheMiddleware llama next() directamente
// sin intentar conectarse. Esto simplifica los tests porque no tenemos
// que simular hits/misses de caché en cada caso.
jest.mock('../../config/redis', () => ({
  getRedisClient: jest.fn().mockReturnValue(null),
}));

// ─── Mock: Keycloak config ───────────────────────────────────────────────────
jest.mock('../../config/keycloak', () => ({
  keycloakConfig: {
    tokenUrl: 'http://keycloak/token',
    adminBaseUrl: 'http://keycloak/admin/realms/restaurant-realm',
    adminClientId: 'admin-cli',
    adminClientSecret: 'secret',
    clientId: 'restaurant-api',
    clientSecret: 'client-secret',
    issuer: 'http://keycloak/realms/restaurant-realm',
  },
  jwksClientInstance: { getSigningKey: jest.fn() },
}));

// ─── Mock: auth.middleware ────────────────────────────────────────────────────
// Reemplazamos la verificación JWT real por una función que inyecta
// directamente req.user. Los tests que necesiten un usuario admin
// pueden importar mockAuthUser y cambiar el rol antes del request.
export const mockAuthUser = {
  sub: 'test-user-kc-id',
  email: 'test@test.com',
  roles: ['client'] as string[],
};

jest.mock('../../middlewares/auth.middleware', () => ({
  authenticate: (req: any, _res: any, next: any) => {
    req.user = mockAuthUser;
    next();
  },
}));

// ─── Instancia compartida de supertest ───────────────────────────────────────
// Todos los tests de integración importan esto en lugar de crear
// su propio request(app). Una sola instancia, sin levantar un servidor real.
export const api = request(app);

// Limpiar mocks entre cada test para que no se contaminen entre sí
beforeEach(() => jest.clearAllMocks());