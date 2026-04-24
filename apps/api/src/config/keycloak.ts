import jwksClient from 'jwks-rsa';
import { env } from './env';

// urls derivadas del realm de keycloak
export const keycloakConfig = {
  baseUrl: env.KEYCLOAK_BASE_URL,
  realm: env.KEYCLOAK_REALM,
  clientId: env.KEYCLOAK_CLIENT_ID,
  clientSecret: env.KEYCLOAK_CLIENT_SECRET,
  adminClientId: env.KEYCLOAK_ADMIN_CLIENT_ID,
  adminClientSecret: env.KEYCLOAK_ADMIN_CLIENT_SECRET,

  // openid connect endpoints
  tokenUrl: `${env.KEYCLOAK_BASE_URL}/realms/${env.KEYCLOAK_REALM}/protocol/openid-connect/token`,
  jwksUri: `${env.KEYCLOAK_BASE_URL}/realms/${env.KEYCLOAK_REALM}/protocol/openid-connect/certs`,
  issuer: `${env.KEYCLOAK_BASE_URL}/realms/${env.KEYCLOAK_REALM}`,

  // admin rest api base
  adminBaseUrl: `${env.KEYCLOAK_BASE_URL}/admin/realms/${env.KEYCLOAK_REALM}`,
};

// cliente jwks para validar tokens - cachea las claves publicas
export const jwksClientInstance = jwksClient({
  jwksUri: keycloakConfig.jwksUri,
  cache: true,
  cacheMaxEntries: 5,
  cacheMaxAge: 600000, // 10 minutos
});
