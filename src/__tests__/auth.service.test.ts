import axios from "axios";
import pool from "../config/database";
import { registerUser, loginUser } from "../services/auth.service";

jest.mock("axios");
jest.mock("../config/database", () => ({
  query: jest.fn(),
}));
jest.mock("../config/keycloak", () => ({
  keycloakConfig: {
    tokenUrl: "http://keycloak/token",
    adminBaseUrl: "http://keycloak/admin/realms/myrealm",
    adminClientId: "admin-cli",
    adminClientSecret: "secret",
    clientId: "my-client",
    clientSecret: "client-secret",
  },
}));

const mockedAxios = axios as jest.Mocked<typeof axios>;
const mockedPool = pool as jest.Mocked<typeof pool>;

// ─── Datos reutilizables ─────────────────────────────────────────────────────
const ADMIN_TOKEN = "admin-token-abc";
const KEYCLOAK_USER_ID = "kc-user-123";

const registerInput = {
  fullName: "Juan Perez",
  email: "juan@test.com",
  password: "pass123",
  role: "client" as const,
  phone: "88881234",
};

const dbUserRow = {
  id: 1,
  full_name: "Juan Perez",
  email: "juan@test.com",
  role: "client",
  phone: "88881234",
};

// Helper: configura el happy path de los axios calls de registro
function mockSuccessfulKeycloakRegistration() {
  mockedAxios.post
    // 1. getAdminToken
    .mockResolvedValueOnce({ data: { access_token: ADMIN_TOKEN } })
    // 2. crear usuario en keycloak
    .mockResolvedValueOnce({
      headers: { location: `http://keycloak/users/${KEYCLOAK_USER_ID}` },
    })
    // 4. asignar rol
    .mockResolvedValueOnce({});

  mockedAxios.get
    // 3. obtener representación del rol
    .mockResolvedValueOnce({ data: { id: "role-id", name: "client" } });
}

// ─── registerUser ────────────────────────────────────────────────────────────
describe("registerUser", () => {
  beforeEach(() => jest.clearAllMocks());

  it("registra el usuario en Keycloak y PostgreSQL correctamente", async () => {
    mockSuccessfulKeycloakRegistration();
    (mockedPool.query as jest.Mock).mockResolvedValueOnce({
      rows: [dbUserRow],
    });

    const result = await registerUser(registerInput);

    expect(result).toEqual({
      id: 1,
      fullName: "Juan Perez",
      email: "juan@test.com",
      role: "client",
      phone: "88881234",
    });

    // debe haber llamado al stored procedure con los datos correctos
    expect(mockedPool.query).toHaveBeenCalledWith(
      "SELECT * FROM sp_create_user($1, $2, $3, $4::user_role, $5)",
      ["Juan Perez", "juan@test.com", KEYCLOAK_USER_ID, "client", "88881234"],
    );
  });

  it("extrae firstName y lastName correctamente de fullName", async () => {
    mockSuccessfulKeycloakRegistration();
    (mockedPool.query as jest.Mock).mockResolvedValueOnce({
      rows: [{ ...dbUserRow, full_name: "Maria de los Angeles Mora" }],
    });

    await registerUser({
      ...registerInput,
      fullName: "Maria de los Angeles Mora",
    });

    // segundo post es el de crear usuario en keycloak
    const keycloakCreateCall = mockedAxios.post.mock.calls[1];
    const body = keycloakCreateCall[1] as any;
    expect(body.firstName).toBe("Maria");
    expect(body.lastName).toBe("de los Angeles Mora");
  });

  it("usa null como phone si no se proporciona", async () => {
    mockSuccessfulKeycloakRegistration();
    (mockedPool.query as jest.Mock).mockResolvedValueOnce({
      rows: [{ ...dbUserRow, phone: null }],
    });

    await registerUser({ ...registerInput, phone: undefined });

    expect(mockedPool.query).toHaveBeenCalledWith(
      expect.any(String),
      expect.arrayContaining([null]),
    );
  });

  it("hace rollback en Keycloak si falla la inserción en PostgreSQL", async () => {
    mockSuccessfulKeycloakRegistration();
    (mockedPool.query as jest.Mock).mockRejectedValueOnce(new Error("DB down"));
    mockedAxios.delete = jest.fn().mockResolvedValueOnce({});

    await expect(registerUser(registerInput)).rejects.toThrow(
      "failed to create local user record",
    );

    // debe eliminar el usuario de keycloak como rollback
    expect(mockedAxios.delete).toHaveBeenCalledWith(
      `http://keycloak/admin/realms/myrealm/users/${KEYCLOAK_USER_ID}`,
      expect.objectContaining({
        headers: { Authorization: `Bearer ${ADMIN_TOKEN}` },
      }),
    );
  });

  it("lanza error si Keycloak rechaza la creación del usuario (ej: 409)", async () => {
    mockedAxios.post
      // getAdminToken ok
      .mockResolvedValueOnce({ data: { access_token: ADMIN_TOKEN } })
      // crear usuario → keycloak devuelve 409
      .mockRejectedValueOnce({ response: { status: 409 } });

    await expect(registerUser(registerInput)).rejects.toMatchObject({
      response: { status: 409 },
    });
  });
});

// ─── loginUser ───────────────────────────────────────────────────────────────
describe("loginUser", () => {
  beforeEach(() => jest.clearAllMocks());

  it("devuelve los tokens correctamente al hacer login", async () => {
    mockedAxios.post.mockResolvedValueOnce({
      data: {
        access_token: "access-abc",
        refresh_token: "refresh-xyz",
        expires_in: 300,
        token_type: "Bearer",
      },
    });

    const result = await loginUser({
      email: "juan@test.com",
      password: "pass123",
    });

    expect(result).toEqual({
      accessToken: "access-abc",
      refreshToken: "refresh-xyz",
      expiresIn: 300,
      tokenType: "Bearer",
    });
  });

  it("llama a Keycloak con los parámetros correctos", async () => {
    mockedAxios.post.mockResolvedValueOnce({
      data: {
        access_token: "x",
        refresh_token: "y",
        expires_in: 60,
        token_type: "Bearer",
      },
    });

    await loginUser({ email: "juan@test.com", password: "pass123" });

    const [url, body] = mockedAxios.post.mock.calls[0];
    expect(url).toBe("http://keycloak/token");

    // body es URLSearchParams
    const params = body as URLSearchParams;
    expect(params.get("grant_type")).toBe("password");
    expect(params.get("username")).toBe("juan@test.com");
    expect(params.get("password")).toBe("pass123");
  });

  it("propaga el error de Keycloak cuando las credenciales son inválidas", async () => {
    mockedAxios.post.mockRejectedValueOnce({ response: { status: 401 } });

    await expect(
      loginUser({ email: "wrong@test.com", password: "bad" }),
    ).rejects.toMatchObject({ response: { status: 401 } });
  });
});
