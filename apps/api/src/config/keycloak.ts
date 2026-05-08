import jwksClient from 'jwks-rsa';
import { env } from './env';

export const keycloakConfig = {
  baseUrl: env.KEYCLOAK_BASE_URL,
  realm: env.KEYCLOAK_REALM,
  clientId: env.KEYCLOAK_CLIENT_ID,
  clientSecret: env.KEYCLOAK_CLIENT_SECRET,
  adminClientId: env.KEYCLOAK_ADMIN_CLIENT_ID,
  adminClientSecret: env.KEYCLOAK_ADMIN_CLIENT_SECRET,
  masterAdminUsername: env.KEYCLOAK_MASTER_ADMIN_USERNAME,
  masterAdminPassword: env.KEYCLOAK_MASTER_ADMIN_PASSWORD,

  tokenUrl: `${env.KEYCLOAK_BASE_URL}/realms/${env.KEYCLOAK_REALM}/protocol/openid-connect/token`,
  masterTokenUrl: `${env.KEYCLOAK_BASE_URL}/realms/master/protocol/openid-connect/token`,
  jwksUri: `${env.KEYCLOAK_BASE_URL}/realms/${env.KEYCLOAK_REALM}/protocol/openid-connect/certs`,
  issuer: `${env.KEYCLOAK_BASE_URL}/realms/${env.KEYCLOAK_REALM}`,

  adminBaseUrl: `${env.KEYCLOAK_BASE_URL}/admin/realms/${env.KEYCLOAK_REALM}`,
};

// cachea las claves publicas para no pegarle al jwks en cada request
export const jwksClientInstance = jwksClient({
  jwksUri: keycloakConfig.jwksUri,
  cache: true,
  cacheMaxEntries: 5,
  cacheMaxAge: 600000,
});
