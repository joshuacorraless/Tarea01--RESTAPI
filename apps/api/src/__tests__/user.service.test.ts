import pool from "../config/database";
import {
  getUserByExternalId,
  updateUser,
  softDeleteUser,
} from "../services/user.service";

jest.mock("../config/database", () => ({ query: jest.fn() }));
const mockedPool = pool as jest.Mocked<typeof pool>;

// Datos reutilizables
const userRow = {
  id: "u1",
  full_name: "Ana Mora",
  email: "ana@test.com",
  role: "customer",
  phone: "88880000",
  external_auth_id: "kc-user-123",
  created_at: new Date(),
  updated_at: new Date(),
};

const mappedUser = {
  id: "u1",
  fullName: "Ana Mora",
  email: "ana@test.com",
  role: "customer",
  phone: "88880000",
  createdAt: userRow.created_at,
  updatedAt: userRow.updated_at,
};

beforeEach(() => jest.clearAllMocks());

// getUserByExternalId
describe("getUserByExternalId", () => {
  it("retorna el usuario mapeado si existe", async () => {
    (mockedPool.query as jest.Mock).mockResolvedValueOnce({ rows: [userRow] });

    const result = await getUserByExternalId("kc-user-123");
    expect(result).toEqual(mappedUser);
    expect(mockedPool.query).toHaveBeenCalledWith(
      "SELECT * FROM sp_get_user_by_external_id($1)",
      ["kc-user-123"],
    );
  });

  it("lanza error si el usuario no existe", async () => {
    (mockedPool.query as jest.Mock).mockResolvedValueOnce({ rows: [] });

    await expect(getUserByExternalId("no-existe")).rejects.toThrow(
      "user not found",
    );
  });
});

// updateUser
describe("updateUser", () => {
  const updatedRow = {
    ...userRow,
    full_name: "Ana López",
    updated_at: new Date(),
  };

  it("actualiza y retorna el usuario correctamente", async () => {
    (mockedPool.query as jest.Mock)
      .mockResolvedValueOnce({ rows: [userRow] }) // sp_get_user_by_id
      .mockResolvedValueOnce({ rows: [updatedRow] }); // sp_update_user

    const result = await updateUser("u1", "kc-user-123", {
      fullName: "Ana López",
    });
    expect(result.fullName).toBe("Ana López");
  });

  it("lanza error si el usuario no existe", async () => {
    (mockedPool.query as jest.Mock).mockResolvedValueOnce({ rows: [] });

    await expect(
      updateUser("u999", "kc-user-123", { fullName: "X" }),
    ).rejects.toThrow("user not found");
  });

  it("lanza error forbidden si el externalId no coincide", async () => {
    (mockedPool.query as jest.Mock).mockResolvedValueOnce({
      rows: [{ ...userRow, external_auth_id: "otro-kc-id" }],
    });

    await expect(
      updateUser("u1", "kc-user-123", { fullName: "Hack" }),
    ).rejects.toThrow("forbidden: you can only update your own profile");
  });

  it("pasa fullName y phone como null si no se proporcionan", async () => {
    (mockedPool.query as jest.Mock)
      .mockResolvedValueOnce({ rows: [userRow] })
      .mockResolvedValueOnce({ rows: [updatedRow] });

    await updateUser("u1", "kc-user-123", {});
    const call = (mockedPool.query as jest.Mock).mock.calls[1];
    expect(call[1][1]).toBeNull();
    expect(call[1][2]).toBeNull();
  });
});

// softDeleteUser
describe("softDeleteUser", () => {
  it("ejecuta el soft delete si el usuario es dueño del recurso", async () => {
    (mockedPool.query as jest.Mock)
      .mockResolvedValueOnce({ rows: [userRow] }) // sp_get_user_by_id
      .mockResolvedValueOnce({ rows: [] }); // sp_soft_delete_user

    await softDeleteUser("u1", "kc-user-123");

    expect(mockedPool.query).toHaveBeenNthCalledWith(
      2,
      "SELECT sp_soft_delete_user($1)",
      ["u1"],
    );
  });

  it("lanza error si el usuario no existe", async () => {
    (mockedPool.query as jest.Mock).mockResolvedValueOnce({ rows: [] });

    await expect(softDeleteUser("u999", "kc-user-123")).rejects.toThrow(
      "user not found",
    );
  });

  it("lanza error forbidden si el externalId no coincide", async () => {
    (mockedPool.query as jest.Mock).mockResolvedValueOnce({
      rows: [{ ...userRow, external_auth_id: "otro-kc-id" }],
    });

    await expect(softDeleteUser("u1", "kc-user-123")).rejects.toThrow(
      "forbidden: you can only delete your own account",
    );
  });
});
