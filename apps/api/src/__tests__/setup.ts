// Este archivo se ejecuta antes de cada test suite automáticamente.
// Mockea env.ts para que process.exit(1) nunca se dispare en tests.

jest.mock("../config/env", () => ({
  env: {
    PORT: "3000",
    DATABASE_URL: "postgres://test:test@localhost:5432/test",
    KEYCLOAK_BASE_URL: "http://keycloak:8080",
    KEYCLOAK_REALM: "test-realm",
    KEYCLOAK_CLIENT_ID: "test-client",
    KEYCLOAK_CLIENT_SECRET: "test-secret",
    KEYCLOAK_ADMIN_CLIENT_ID: "admin-cli",
    KEYCLOAK_ADMIN_CLIENT_SECRET: "admin-secret",
    DB_ENGINE: "postgres",
  },
}));

jest.mock("../config/database", () => ({
  query: jest.fn(),
  connect: jest.fn(),
}));

jest.mock("../config/keycloak", () => ({
  keycloakConfig: {
    tokenUrl: "http://keycloak/token",
    adminBaseUrl: "http://keycloak/admin/realms/test-realm",
    adminClientId: "admin-cli",
    adminClientSecret: "admin-secret",
    clientId: "test-client",
    clientSecret: "test-secret",
  },
}));
