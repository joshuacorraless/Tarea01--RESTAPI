// auth.integration.test.ts
//
// Prueba el flujo completo de autenticación:
//   HTTP request → validate middleware (Zod) → auth controller → auth service
//
// Lo que se valida acá que los unitarios NO validan:
//   - El middleware `validate` rechaza bodies inválidos con 400 ANTES de llegar al controller
//   - El formato real de la respuesta JSON (success, message, data)
//   - El routing correcto (POST /api/auth/register, POST /api/auth/login)

import '../setup';                         // activa todos los mocks globales
import { api } from './setup';
import pool from '../../config/database';
import axios from 'axios';

jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

const mockedPool = pool as jest.Mocked<typeof pool>;

// ─── POST /api/auth/register ──────────────────────────────────────────────────
describe('POST /api/auth/register', () => {
  const validBody = {
    fullName: 'Carlos Mora',
    email: 'carlos@test.com',
    password: 'Pass123!',
    role: 'client',
    phone: '+506 8888-1234',
  };

  it('registra un usuario y responde 201 con el formato correcto', async () => {
    // Simular Keycloak: getAdminToken → crear usuario → getRoleRep → asignarRol
    mockedAxios.post
      .mockResolvedValueOnce({ data: { access_token: 'admin-tok' } })
      .mockResolvedValueOnce({ headers: { location: 'http://kc/users/kc-123' } })
      .mockResolvedValueOnce({});
    mockedAxios.get.mockResolvedValueOnce({ data: { id: 'role-id', name: 'client' } });

    // Simular la inserción en BD
    (mockedPool.query as jest.Mock).mockResolvedValueOnce({
      rows: [{
        id: 'u-1',
        full_name: 'Carlos Mora',
        email: 'carlos@test.com',
        role: 'client',
        phone: '+506 8888-1234',
      }],
    });

    const res = await api.post('/api/auth/register').send(validBody);

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.message).toBe('user registered successfully');
    expect(res.body.data.email).toBe('carlos@test.com');
  });

  it('responde 400 si falta el campo email (validación Zod)', async () => {
    const res = await api.post('/api/auth/register').send({
      fullName: 'Carlos',
      password: 'Pass123!',
      role: 'client',
      // email ausente
    });

    // El middleware validate() rechaza antes de llegar al controller
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('responde 400 si el email tiene formato inválido', async () => {
    const res = await api.post('/api/auth/register').send({
      ...validBody,
      email: 'no-es-un-email',
    });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('responde 400 si el role no es válido', async () => {
    const res = await api.post('/api/auth/register').send({
      ...validBody,
      role: 'superadmin', // no existe en el enum
    });

    expect(res.status).toBe(400);
  });

  it('responde 409 si el usuario ya existe en Keycloak', async () => {
    mockedAxios.post
      .mockResolvedValueOnce({ data: { access_token: 'admin-tok' } })
      .mockRejectedValueOnce({ response: { status: 409 } });

    const res = await api.post('/api/auth/register').send(validBody);

    expect(res.status).toBe(409);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toBe('user with this email already exists');
  });
});

// ─── POST /api/auth/login ─────────────────────────────────────────────────────
describe('POST /api/auth/login', () => {
  const validBody = {
    email: 'carlos@test.com',
    password: 'Pass123!',
  };

  it('responde 200 con los tokens al hacer login exitoso', async () => {
    mockedAxios.post.mockResolvedValueOnce({
      data: {
        access_token: 'acc-tok',
        refresh_token: 'ref-tok',
        expires_in: 1800,
        token_type: 'Bearer',
      },
    });

    const res = await api.post('/api/auth/login').send(validBody);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toMatchObject({
      accessToken: 'acc-tok',
      refreshToken: 'ref-tok',
      tokenType: 'Bearer',
    });
  });

  it('responde 400 si falta la contraseña', async () => {
    const res = await api.post('/api/auth/login').send({ email: 'a@b.com' });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('responde 400 si el body está completamente vacío', async () => {
    const res = await api.post('/api/auth/login').send({});

    expect(res.status).toBe(400);
  });

  it('responde 401 si las credenciales son inválidas', async () => {
    mockedAxios.post.mockRejectedValueOnce({ response: { status: 401 } });

    const res = await api.post('/api/auth/login').send(validBody);

    expect(res.status).toBe(401);
    expect(res.body.message).toBe('invalid email or password');
  });
});