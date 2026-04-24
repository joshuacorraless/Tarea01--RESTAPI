import { Response } from "express";
import { sendSuccess, sendError } from "../utils/response";

// mock de res con encadenamiento status().json()
function mockRes() {
  const json = jest.fn();
  const status = jest.fn().mockReturnValue({ json });
  return {
    res: { status, json: jest.fn() } as unknown as Response,
    status,
    json,
  };
}

describe("sendSuccess", () => {
  it("responde con status 200 y success:true por defecto", () => {
    const { res, status, json } = mockRes();
    sendSuccess(res, { id: 1 });

    expect(status).toHaveBeenCalledWith(200);
    expect(json).toHaveBeenCalledWith({
      success: true,
      message: "ok",
      data: { id: 1 },
    });
  });

  it("responde con statusCode y mensaje personalizados", () => {
    const { res, status, json } = mockRes();
    sendSuccess(res, { id: 2 }, "creado correctamente", 201);

    expect(status).toHaveBeenCalledWith(201);
    expect(json).toHaveBeenCalledWith({
      success: true,
      message: "creado correctamente",
      data: { id: 2 },
    });
  });

  it("acepta null como data", () => {
    const { res, status, json } = mockRes();
    sendSuccess(res, null, "sin datos");

    expect(status).toHaveBeenCalledWith(200);
    expect(json).toHaveBeenCalledWith({
      success: true,
      message: "sin datos",
      data: null,
    });
  });
});

describe("sendError", () => {
  it("responde con status 500 por defecto y success:false", () => {
    const { res, status, json } = mockRes();
    sendError(res, "algo salió mal");

    expect(status).toHaveBeenCalledWith(500);
    expect(json).toHaveBeenCalledWith({
      success: false,
      message: "algo salió mal",
      data: null,
    });
  });

  it("responde con statusCode personalizado", () => {
    const { res, status, json } = mockRes();
    sendError(res, "no encontrado", 404);

    expect(status).toHaveBeenCalledWith(404);
    expect(json).toHaveBeenCalledWith({
      success: false,
      message: "no encontrado",
      data: null,
    });
  });

  it("siempre envía data:null en errores", () => {
    const { res, status, json } = mockRes();
    sendError(res, "forbidden", 403);

    expect(json).toHaveBeenCalledWith(expect.objectContaining({ data: null }));
  });
});
