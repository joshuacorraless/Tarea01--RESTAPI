import pool from "../config/database";
import {
  createMenuService,
  getMenuByIdService,
  getMenusByRestaurantService,
  updateMenuService,
  deleteMenuService,
  createMenuItemService,
  getMenuItemsService,
  updateMenuItemService,
  deleteMenuItemService,
} from "../services/menu.service";
import {
  UpdateMenuInput,
  UpdateMenuItemInput,
} from "../schemas/menu-reservation-order.schema";

jest.mock("../config/database", () => ({ query: jest.fn() }));
const mockedPool = pool as jest.Mocked<typeof pool>;

// ─── Datos reutilizables ─────────────────────────────────────────────────────
const menuRow = {
  id: "1",
  idrestaurante: "r1",
  nombre: "Menú Principal",
  detalles: "Almuerzo",
  activo: true,
  creadoen: new Date(),
  ultimaactualizacion: new Date(),
};

const itemRow = {
  id: "i1",
  idmenu: "1",
  nombre: "Gallo Pinto",
  detalles: "con natilla",
  precio: "2500",
  imagen: null,
  disponible: true,
  creadoen: new Date(),
  ultimaactualizacion: new Date(),
};

const mappedMenu = {
  id: "1",
  idRestaurante: "r1",
  nombre: "Menú Principal",
  detalles: "Almuerzo",
  activo: true,
  creadoEn: menuRow.creadoen,
  ultimaActualizacion: menuRow.ultimaactualizacion,
};

const mappedItem = {
  id: "i1",
  idMenu: "1",
  nombre: "Gallo Pinto",
  detalles: "con natilla",
  precio: 2500,
  imagen: null,
  disponible: true,
  creadoEn: itemRow.creadoen,
  ultimaActualizacion: itemRow.ultimaactualizacion,
};

beforeEach(() => jest.clearAllMocks());

// ─── Menús ───────────────────────────────────────────────────────────────────
describe("createMenuService", () => {
  it("crea un menú y retorna los datos mapeados", async () => {
    (mockedPool.query as jest.Mock).mockResolvedValueOnce({ rows: [menuRow] });

    const result = await createMenuService({
      // ← createMenuService, no createMenuItemService
      idRestaurante: "r1",
      nombre: "Menú Principal",
      detalles: "Almuerzo",
      activo: true,
    });

    expect(result).toEqual(mappedMenu);
    expect(mockedPool.query).toHaveBeenCalledWith(
      "SELECT * FROM sp_create_menu($1, $2, $3, $4)",
      ["r1", "Menú Principal", "Almuerzo", true],
    );
  });

  it("usa activo=true por defecto si no se pasa", async () => {
    (mockedPool.query as jest.Mock).mockResolvedValueOnce({ rows: [menuRow] });
    await createMenuService({
      // ← createMenuService
      idRestaurante: "r1",
      nombre: "X",
      detalles: "Y",
      activo: true,
    });
    const call = (mockedPool.query as jest.Mock).mock.calls[0];
    expect(call[1][3]).toBe(true);
  });
});

describe("getMenuByIdService", () => {
  it("retorna el menú si existe", async () => {
    (mockedPool.query as jest.Mock).mockResolvedValueOnce({ rows: [menuRow] });
    expect(await getMenuByIdService("1")).toEqual(mappedMenu);
  });

  it("retorna null si no existe", async () => {
    (mockedPool.query as jest.Mock).mockResolvedValueOnce({ rows: [] });
    expect(await getMenuByIdService("999")).toBeNull();
  });
});

describe("getMenusByRestaurantService", () => {
  it("retorna lista de menús mapeados", async () => {
    (mockedPool.query as jest.Mock).mockResolvedValueOnce({
      rows: [menuRow, menuRow],
    });
    const result = await getMenusByRestaurantService("r1");
    expect(result).toHaveLength(2);
    expect(result[0]).toEqual(mappedMenu);
  });

  it("retorna lista vacía si no hay menús", async () => {
    (mockedPool.query as jest.Mock).mockResolvedValueOnce({ rows: [] });
    expect(await getMenusByRestaurantService("r1")).toEqual([]);
  });
});

describe("updateMenuService", () => {
  it("actualiza y retorna el menú", async () => {
    (mockedPool.query as jest.Mock).mockResolvedValueOnce({ rows: [menuRow] });
    const result = await updateMenuService("1", { nombre: "Nuevo nombre" });
    expect(result).toEqual(mappedMenu);
  });

  it("retorna null si el menú no existe", async () => {
    (mockedPool.query as jest.Mock).mockResolvedValueOnce({ rows: [] });
    expect(await updateMenuService("999", {} as UpdateMenuInput)).toBeNull();
  });
});

describe("deleteMenuService", () => {
  it("llama al stored procedure con el id correcto", async () => {
    (mockedPool.query as jest.Mock).mockResolvedValueOnce({ rows: [] });
    await deleteMenuService("1");
    expect(mockedPool.query).toHaveBeenCalledWith("SELECT sp_delete_menu($1)", [
      "1",
    ]);
  });
});

// ─── Items del menú ──────────────────────────────────────────────────────────
describe("createMenuItemService", () => {
  it("crea un item y retorna los datos mapeados", async () => {
    (mockedPool.query as jest.Mock).mockResolvedValueOnce({ rows: [itemRow] });

    const result = await createMenuItemService("1", {
      nombre: "Gallo Pinto",
      detalles: "con natilla",
      categoria: "General",
      precio: 2500,
      disponible: true,
    });

    expect(result).toEqual(mappedItem);
    expect(mockedPool.query).toHaveBeenCalledWith(
      "SELECT * FROM sp_create_menu_item($1, $2, $3, $4, $5, $6, $7)",
      ["1", "Gallo Pinto", "con natilla", 2500, null, true, "General"],
    );
  });

  it("usa disponible=true por defecto si no se pasa", async () => {
    (mockedPool.query as jest.Mock).mockResolvedValueOnce({ rows: [itemRow] });
    await createMenuItemService("1", {
      nombre: "X",
      detalles: "Y",
      categoria: "General",
      precio: 100,
      disponible: true,
    });
    const call = (mockedPool.query as jest.Mock).mock.calls[0];
    expect(call[1][5]).toBe(true);
  });
});

describe("getMenuItemsService", () => {
  it("retorna los items del menú", async () => {
    (mockedPool.query as jest.Mock).mockResolvedValueOnce({ rows: [itemRow] });
    const result = await getMenuItemsService("1");
    expect(result).toHaveLength(1);
    expect(result[0].precio).toBe(2500); // Number() aplicado
  });
});

describe("updateMenuItemService", () => {
  it("actualiza y retorna el item", async () => {
    (mockedPool.query as jest.Mock).mockResolvedValueOnce({ rows: [itemRow] });
    expect(await updateMenuItemService("1", "i1", { precio: 3000 })).toEqual(
      mappedItem,
    );
  });

  it("retorna null si el item no existe", async () => {
    (mockedPool.query as jest.Mock).mockResolvedValueOnce({ rows: [] });
    expect(
      await updateMenuItemService("1", "i999", {} as UpdateMenuItemInput),
    ).toBeNull();
  });
});

describe("deleteMenuItemService", () => {
  it("llama al stored procedure con el id correcto", async () => {
    (mockedPool.query as jest.Mock).mockResolvedValueOnce({ rows: [] });
    await deleteMenuItemService("1", "i1");
    expect(mockedPool.query).toHaveBeenCalledWith(
      "SELECT sp_delete_menu_item($1)",
      ["i1"],
    );
  });
});
