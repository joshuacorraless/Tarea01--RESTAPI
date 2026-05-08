import pool from "../config/database";
import {
  createRestaurant,
  listRestaurants,
} from "../services/restaurant.service";

jest.mock("../config/database", () => ({ query: jest.fn() }));
const mockedPool = pool as jest.Mocked<typeof pool>;

// Datos reutilizables
const adminRow = { id: "u1", external_auth_id: "kc-admin-1" };

const restaurantRow = {
  id: "rest1",
  name: "La Soda",
  description: "Comida típica",
  address: "Cartago Centro",
  phone: "22221234",
  opening_hours: "L-V 8am-5pm",
  admin_user_id: "u1",
  created_at: new Date(),
};

const restaurantListRow = {
  ...restaurantRow,
  updated_at: new Date(),
  admin_name: "Carlos Admin",
  admin_email: "carlos@admin.com",
};

const mappedRestaurant = {
  id: "rest1",
  name: "La Soda",
  description: "Comida típica",
  address: "Cartago Centro",
  phone: "22221234",
  openingHours: "L-V 8am-5pm",
  adminUserId: "u1",
  createdAt: restaurantRow.created_at,
};

beforeEach(() => jest.clearAllMocks());

// createRestaurant
describe("createRestaurant", () => {
  const input = {
    name: "La Soda",
    address: "Cartago Centro",
    description: "Comida típica",
    phone: "22221234",
    openingHours: "L-V 8am-5pm",
  };

  it("crea el restaurante y retorna los datos mapeados", async () => {
    (mockedPool.query as jest.Mock)
      .mockResolvedValueOnce({ rows: [adminRow] }) // sp_get_user_by_external_id
      .mockResolvedValueOnce({ rows: [restaurantRow] }); // sp_create_restaurant

    const result = await createRestaurant("kc-admin-1", input);
    expect(result).toEqual(mappedRestaurant);
  });

  it("lanza error si el admin no existe", async () => {
    (mockedPool.query as jest.Mock).mockResolvedValueOnce({ rows: [] });

    await expect(createRestaurant("no-existe", input)).rejects.toThrow(
      "admin user not found",
    );
  });

  it("pasa description como null si no se proporciona", async () => {
    (mockedPool.query as jest.Mock)
      .mockResolvedValueOnce({ rows: [adminRow] })
      .mockResolvedValueOnce({ rows: [restaurantRow] });

    await createRestaurant("kc-admin-1", { name: "X", address: "Y" });
    const call = (mockedPool.query as jest.Mock).mock.calls[1];
    expect(call[1][1]).toBeNull();
  });

  it("pasa phone como null si no se proporciona", async () => {
    (mockedPool.query as jest.Mock)
      .mockResolvedValueOnce({ rows: [adminRow] })
      .mockResolvedValueOnce({ rows: [restaurantRow] });

    await createRestaurant("kc-admin-1", { name: "X", address: "Y" });
    const call = (mockedPool.query as jest.Mock).mock.calls[1];
    expect(call[1][3]).toBeNull(); 
  });

  it("llama a sp_get_user_by_external_id con el externalId correcto", async () => {
    (mockedPool.query as jest.Mock)
      .mockResolvedValueOnce({ rows: [adminRow] })
      .mockResolvedValueOnce({ rows: [restaurantRow] });

    await createRestaurant("kc-admin-1", input);
    expect(mockedPool.query).toHaveBeenNthCalledWith(
      1,
      "SELECT * FROM sp_get_user_by_external_id($1)",
      ["kc-admin-1"],
    );
  });
});

// listRestaurants
describe("listRestaurants", () => {
  it("retorna la lista de restaurantes con info del admin", async () => {
    (mockedPool.query as jest.Mock).mockResolvedValueOnce({
      rows: [restaurantListRow],
    });

    const result = await listRestaurants();

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      id: "rest1",
      name: "La Soda",
      adminUser: { fullName: "Carlos Admin", email: "carlos@admin.com" },
    });
  });

  it("retorna lista vacía si no hay restaurantes", async () => {
    (mockedPool.query as jest.Mock).mockResolvedValueOnce({ rows: [] });
    expect(await listRestaurants()).toEqual([]);
  });

  it("mapea openingHours correctamente desde opening_hours", async () => {
    (mockedPool.query as jest.Mock).mockResolvedValueOnce({
      rows: [restaurantListRow],
    });
    const result = await listRestaurants();
    expect(result[0].openingHours).toBe("L-V 8am-5pm");
  });
});
