import pool from "../config/database";
import {
  getAvailableTablesService,
  createReservationService,
  getReservationByIdService,
  getReservationsByClientService,
  getReservationsByRestaurantService,
  cancelReservationService,
} from "../services/reservation.service";

jest.mock("../config/database", () => ({ query: jest.fn() }));
const mockedPool = pool as jest.Mocked<typeof pool>;

// Datos reutilizables
const reservationRow = {
  id: "res1",
  idrestaurante: "r1",
  mesaid: "mesa1",
  idclienteusuario: "u1",
  tamannoreserva: 2,
  reservadopara: new Date("2026-04-01T12:00:00Z"),
  duracionreserva: 90,
  estado: "confirmada",
  notas: null,
  creadoen: new Date(),
  ultimaactualizacion: new Date(),
};

const tableRow = {
  id: "mesa1",
  idrestaurante: "r1",
  numeromesa: 5,
  capacidad: 4,
  disponible: true,
};

const clientRow = { id: "u1", external_auth_id: "kc-user-123" };

const mappedReservation = {
  id: "res1",
  idRestaurante: "r1",
  mesaId: "mesa1",
  idClienteUsuario: "u1",
  tamannoReserva: 2,
  reservadoPara: new Date("2026-04-01T12:00:00Z"),
  duracionReserva: 90,
  estado: "confirmada",
  notas: null,
  creadoEn: reservationRow.creadoen,
  ultimaActualizacion: reservationRow.ultimaactualizacion,
};

beforeEach(() => jest.clearAllMocks());

// Mesas disponibles
describe("getAvailableTablesService", () => {
  it("retorna mesas disponibles mapeadas", async () => {
    (mockedPool.query as jest.Mock).mockResolvedValueOnce({ rows: [tableRow] });

    const fecha = new Date("2026-04-01T12:00:00Z");
    const result = await getAvailableTablesService("r1", fecha, 90);

    expect(result).toEqual([
      {
        id: "mesa1",
        idRestaurante: "r1",
        numeroMesa: 5,
        capacidad: 4,
        disponible: true,
      },
    ]);
    expect(mockedPool.query).toHaveBeenCalledWith(
      "SELECT * FROM sp_get_available_tables($1, $2, $3)",
      ["r1", fecha, 90],
    );
  });

  it("usa duración 90 por defecto", async () => {
    (mockedPool.query as jest.Mock).mockResolvedValueOnce({ rows: [] });
    await getAvailableTablesService("r1", new Date());
    const call = (mockedPool.query as jest.Mock).mock.calls[0];
    expect(call[1][2]).toBe(90);
  });

  it("retorna lista vacía si no hay mesas", async () => {
    (mockedPool.query as jest.Mock).mockResolvedValueOnce({ rows: [] });
    expect(await getAvailableTablesService("r1", new Date())).toEqual([]);
  });
});

// Crear reserva
describe("createReservationService", () => {
  const input = {
    idCliente: "kc-user-123",
    idRestaurante: "r1",
    mesaId: "mesa1",
    tamannoReserva: 2,
    reservadoPara: "2026-04-01T12:00:00Z",
    duracionReserva: 90,
  };

  it("crea la reserva correctamente", async () => {
    (mockedPool.query as jest.Mock)
      .mockResolvedValueOnce({ rows: [clientRow] }) // sp_get_user_by_external_id
      .mockResolvedValueOnce({ rows: [reservationRow] }); // sp_create_reservation

    const result = await createReservationService(input);
    expect(result).toEqual(mappedReservation);
  });

  it("lanza error si el cliente no existe", async () => {
    (mockedPool.query as jest.Mock).mockResolvedValueOnce({ rows: [] });

    await expect(createReservationService(input)).rejects.toThrow(
      "Usuario cliente no encontrado",
    );
  });

  it("usa duracionReserva=90 por defecto", async () => {
    (mockedPool.query as jest.Mock)
      .mockResolvedValueOnce({ rows: [clientRow] })
      .mockResolvedValueOnce({ rows: [reservationRow] });

    await createReservationService(input); // sin duracionReserva
    const call = (mockedPool.query as jest.Mock).mock.calls[1];
    expect(call[1][5]).toBe(90);
  });

  it("pasa notas como null si no se proporciona", async () => {
    (mockedPool.query as jest.Mock)
      .mockResolvedValueOnce({ rows: [clientRow] })
      .mockResolvedValueOnce({ rows: [reservationRow] });

    await createReservationService(input);
    const call = (mockedPool.query as jest.Mock).mock.calls[1];
    expect(call[1][6]).toBeNull();
  });
});

// Obtener reserva por ID
describe("getReservationByIdService", () => {
  it("retorna la reserva si existe", async () => {
    (mockedPool.query as jest.Mock).mockResolvedValueOnce({
      rows: [reservationRow],
    });
    expect(await getReservationByIdService("res1")).toEqual(mappedReservation);
  });

  it("retorna null si no existe", async () => {
    (mockedPool.query as jest.Mock).mockResolvedValueOnce({ rows: [] });
    expect(await getReservationByIdService("999")).toBeNull();
  });
});

// Reservas por cliente
describe("getReservationsByClientService", () => {
  it("retorna las reservas del cliente", async () => {
    (mockedPool.query as jest.Mock)
      .mockResolvedValueOnce({ rows: [clientRow] })
      .mockResolvedValueOnce({ rows: [reservationRow] });

    const result = await getReservationsByClientService("kc-user-123");
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual(mappedReservation);
  });

  it("retorna [] si el cliente no existe en BD local", async () => {
    (mockedPool.query as jest.Mock).mockResolvedValueOnce({ rows: [] });
    expect(await getReservationsByClientService("no-existe")).toEqual([]);
  });
});

// Reservas por restaurante
describe("getReservationsByRestaurantService", () => {
  it("retorna las reservas del restaurante", async () => {
    (mockedPool.query as jest.Mock).mockResolvedValueOnce({
      rows: [reservationRow],
    });
    const result = await getReservationsByRestaurantService("r1");
    expect(result).toHaveLength(1);
    expect(result[0].idRestaurante).toBe("r1");
  });
});

// Cancelar reserva
describe("cancelReservationService", () => {
  it("cancela la reserva y la retorna", async () => {
    (mockedPool.query as jest.Mock)
      .mockResolvedValueOnce({ rows: [clientRow] })
      .mockResolvedValueOnce({
        rows: [{ ...reservationRow, estado: "cancelada" }],
      });

    const result = await cancelReservationService("res1", "kc-user-123");
    expect(result?.estado).toBe("cancelada");
  });

  it("retorna null si el cliente no existe", async () => {
    (mockedPool.query as jest.Mock).mockResolvedValueOnce({ rows: [] });
    expect(await cancelReservationService("res1", "no-existe")).toBeNull();
  });

  it("retorna null si la reserva no existe o no le pertenece", async () => {
    (mockedPool.query as jest.Mock)
      .mockResolvedValueOnce({ rows: [clientRow] })
      .mockResolvedValueOnce({ rows: [] }); // sp_cancel_reservation devuelve vacío

    expect(await cancelReservationService("res999", "kc-user-123")).toBeNull();
  });
});
