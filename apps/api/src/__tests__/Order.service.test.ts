import pool from "../config/database";
import {
  createOrderService,
  getOrderByIdService,
  getOrdersByClientService,
  addItemToOrderService,
  updateOrderStatusService,
} from "../services/order.service";

jest.mock("../config/database", () => ({
  query: jest.fn(),
  connect: jest.fn(),
}));
const mockedPool = pool as jest.Mocked<typeof pool>;

// ─── Mock del cliente de transacción ─────────────────────────────────────────
const mockClient = {
  query: jest.fn(),
  release: jest.fn(),
};

// ─── Datos reutilizables ─────────────────────────────────────────────────────
const orderRow = {
  id: "ord1",
  idrestaurante: "r1",
  idclienteusuario: "u1",
  idreserva: null,
  tipoorden: "en-restaurante",
  estado: "pendiente",
  total: "15000",
  notas: null,
  creadoen: new Date(),
  ultimaactualizacion: new Date(),
  items: [],
};

const clientRow = { id: "u1", external_auth_id: "kc-user-123" };

const mappedOrder = {
  id: "ord1",
  idRestaurante: "r1",
  idClienteUsuario: "u1",
  idReserva: null,
  tipoOrden: "en-restaurante",
  estado: "pendiente",
  total: 15000,
  notas: null,
  creadoEn: orderRow.creadoen,
  ultimaActualizacion: orderRow.ultimaactualizacion,
  items: [],
};

beforeEach(() => {
  jest.clearAllMocks();
  (mockedPool.connect as jest.Mock).mockResolvedValue(mockClient);
  mockClient.query.mockResolvedValue({ rows: [] }); // default vacío
});

// ─── createOrderService ───────────────────────────────────────────────────────
describe("createOrderService", () => {
  const input = {
    idCliente: "kc-user-123",
    idRestaurante: "r1",
    tipoOrden: "en-restaurante" as const,
    items: [{ idItemMenu: "item1", cantidad: 2 }],
  };

  it("crea la orden completa con items y commit", async () => {
    (mockedPool.query as jest.Mock).mockResolvedValueOnce({
      rows: [clientRow],
    });

    mockClient.query
      .mockResolvedValueOnce({}) // BEGIN
      .mockResolvedValueOnce({ rows: [orderRow] }) // sp_create_order
      .mockResolvedValueOnce({ rows: [{}] }) // sp_add_order_item
      .mockResolvedValueOnce({ rows: [] }) // sp_recalculate_order_total
      .mockResolvedValueOnce({ rows: [orderRow] }) // sp_get_order_by_id
      .mockResolvedValueOnce({}); // COMMIT

    const result = await createOrderService(input);

    expect(result).toEqual(mappedOrder);
    expect(mockClient.query).toHaveBeenCalledWith("BEGIN");
    expect(mockClient.query).toHaveBeenCalledWith("COMMIT");
    expect(mockClient.release).toHaveBeenCalled();
  });

  it("hace ROLLBACK y lanza error si falla algo en la transacción", async () => {
    (mockedPool.query as jest.Mock).mockResolvedValueOnce({
      rows: [clientRow],
    });

    mockClient.query
      .mockResolvedValueOnce({}) // BEGIN
      .mockResolvedValueOnce({ rows: [orderRow] }) // sp_create_order
      .mockRejectedValueOnce(new Error("item no existe")); // sp_add_order_item falla

    await expect(createOrderService(input)).rejects.toThrow("item no existe");

    expect(mockClient.query).toHaveBeenCalledWith("ROLLBACK");
    expect(mockClient.release).toHaveBeenCalled();
  });

  it("lanza error si el cliente no existe", async () => {
    (mockedPool.query as jest.Mock).mockResolvedValueOnce({ rows: [] });
    await expect(createOrderService(input)).rejects.toThrow(
      "usuario de cliente no encontrado",
    );
  });

  it("pasa idReserva como null si no se proporciona", async () => {
    (mockedPool.query as jest.Mock).mockResolvedValueOnce({
      rows: [clientRow],
    });

    mockClient.query
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({ rows: [orderRow] })
      .mockResolvedValueOnce({ rows: [{}] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [orderRow] })
      .mockResolvedValueOnce({});

    await createOrderService(input);
    const createOrderCall = mockClient.query.mock.calls[1];
    expect(createOrderCall[1][2]).toBeNull();
  });
});

// ─── getOrderByIdService ──────────────────────────────────────────────────────
describe("getOrderByIdService", () => {
  it("retorna la orden si existe", async () => {
    (mockedPool.query as jest.Mock).mockResolvedValueOnce({ rows: [orderRow] });
    expect(await getOrderByIdService("ord1")).toEqual(mappedOrder);
  });

  it("retorna null si no existe", async () => {
    (mockedPool.query as jest.Mock).mockResolvedValueOnce({ rows: [] });
    expect(await getOrderByIdService("999")).toBeNull();
  });

  it("convierte total a Number", async () => {
    (mockedPool.query as jest.Mock).mockResolvedValueOnce({ rows: [orderRow] });
    const result = await getOrderByIdService("ord1");
    expect(typeof result?.total).toBe("number");
    expect(result?.total).toBe(15000);
  });
});

// ─── getOrdersByClientService ─────────────────────────────────────────────────
describe("getOrdersByClientService", () => {
  it("retorna las órdenes del cliente mapeadas", async () => {
    (mockedPool.query as jest.Mock)
      .mockResolvedValueOnce({ rows: [clientRow] })
      .mockResolvedValueOnce({ rows: [orderRow] });

    const result = await getOrdersByClientService("kc-user-123");
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("ord1");
    expect(typeof result[0].total).toBe("number");
  });

  it("retorna [] si el cliente no existe localmente", async () => {
    (mockedPool.query as jest.Mock).mockResolvedValueOnce({ rows: [] });
    expect(await getOrdersByClientService("no-existe")).toEqual([]);
  });
});

// ─── addItemToOrderService ────────────────────────────────────────────────────
describe("addItemToOrderService", () => {
  const itemInput = { idItemMenu: "item2", cantidad: 1 };

  it("agrega el item y hace commit", async () => {
    (mockedPool.query as jest.Mock).mockResolvedValueOnce({
      rows: [{ ...orderRow, estado: "pendiente" }],
    });

    const newItemRow = {
      id: "oi1",
      idorden: "ord1",
      iditem: "item2",
      cantidad: 1,
    };
    mockClient.query
      .mockResolvedValueOnce({}) // BEGIN
      .mockResolvedValueOnce({ rows: [newItemRow] }) // sp_add_order_item
      .mockResolvedValueOnce({ rows: [] }) // sp_recalculate_order_total
      .mockResolvedValueOnce({}); // COMMIT

    const result = await addItemToOrderService("ord1", itemInput);
    expect(result).toEqual(newItemRow);
    expect(mockClient.query).toHaveBeenCalledWith("COMMIT");
    expect(mockClient.release).toHaveBeenCalled();
  });

  it("lanza error si la orden no existe", async () => {
    (mockedPool.query as jest.Mock).mockResolvedValueOnce({ rows: [] });
    await expect(addItemToOrderService("999", itemInput)).rejects.toThrow(
      "orden no encontrada",
    );
  });

  it("lanza error si la orden no está en estado pendiente", async () => {
    (mockedPool.query as jest.Mock).mockResolvedValueOnce({
      rows: [{ ...orderRow, estado: "confirmada" }],
    });
    await expect(addItemToOrderService("ord1", itemInput)).rejects.toThrow(
      "solo puede agregar items a ordenes en estado pendientes",
    );
  });

  it("hace ROLLBACK si falla sp_add_order_item", async () => {
    (mockedPool.query as jest.Mock).mockResolvedValueOnce({
      rows: [{ ...orderRow, estado: "pendiente" }],
    });

    mockClient.query
      .mockResolvedValueOnce({}) // BEGIN
      .mockRejectedValueOnce(new Error("constraint error")); // sp_add_order_item falla

    await expect(addItemToOrderService("ord1", itemInput)).rejects.toThrow();
    expect(mockClient.query).toHaveBeenCalledWith("ROLLBACK");
    expect(mockClient.release).toHaveBeenCalled();
  });
});

// ─── updateOrderStatusService ─────────────────────────────────────────────────
describe("updateOrderStatusService", () => {
  it("actualiza el estado y retorna los datos", async () => {
    const updatedRow = {
      id: "ord1",
      estado: "confirmada",
      ultimaactualizacion: new Date(),
    };
    (mockedPool.query as jest.Mock).mockResolvedValueOnce({
      rows: [updatedRow],
    });

    const result = await updateOrderStatusService("ord1", "confirmada");
    expect(result?.estado).toBe("confirmada");
    expect(result?.id).toBe("ord1");
  });

  it("retorna null si la orden no existe", async () => {
    (mockedPool.query as jest.Mock).mockResolvedValueOnce({ rows: [] });
    expect(await updateOrderStatusService("999", "cancelada")).toBeNull();
  });
});
