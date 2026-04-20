import axios from 'axios';
import { keycloakConfig } from '../config/keycloak';
import { dao } from '../dao/DaoFactory';
import { LoginInput, RegisterInput } from '../schemas/auth.schema';

// obtiene un token de admin para llamar a keycloak admin api
async function getAdminToken(): Promise<string> {
  const params = new URLSearchParams({
    grant_type: 'client_credentials',
    client_id: keycloakConfig.adminClientId,
    client_secret: keycloakConfig.adminClientSecret,
  });

  const response = await axios.post(keycloakConfig.tokenUrl, params, {
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  });

  return response.data.access_token;
}

// registra un usuario nuevo en keycloak y luego crea el registro local
export async function registerUser(input: RegisterInput) {
  const adminToken = await getAdminToken();

  // 1. crear usuario en keycloak
  const createUserResponse = await axios.post(
    `${keycloakConfig.adminBaseUrl}/users`,
    {
      username: input.email,
      email: input.email,
      firstName: input.fullName.split(' ')[0],
      lastName: input.fullName.split(' ').slice(1).join(' ') || '',
      enabled: true,
      credentials: [
        {
          type: 'password',
          value: input.password,
          temporary: false,
        },
      ],
    },
    {
      headers: { Authorization: `Bearer ${adminToken}` },
    }
  );

  // 2. obtener el id del usuario creado (keycloak lo devuelve en el header location)
  const locationHeader = createUserResponse.headers.location;
  const keycloakUserId = locationHeader.split('/').pop()!;

  // 3. obtener la representacion del rol del realm
  const rolesResponse = await axios.get(
    `${keycloakConfig.adminBaseUrl}/roles/${input.role}`,
    {
      headers: { Authorization: `Bearer ${adminToken}` },
    }
  );
  const roleRepresentation = rolesResponse.data;

  // 4. asignar realm role al usuario en keycloak
  await axios.post(
    `${keycloakConfig.adminBaseUrl}/users/${keycloakUserId}/role-mappings/realm`,
    [roleRepresentation],
    {
      headers: { Authorization: `Bearer ${adminToken}` },
    }
  );

  // 5. crear registro local en postgresql; si falla, rollback del lado de keycloak
  //    para evitar usuarios huerfanos entre los dos sistemas
  try {
    const user = await dao.users.create({
      fullName: input.fullName,
      email: input.email,
      externalAuthId: keycloakUserId,
      role: input.role,
      phone: input.phone || null,
    });

    return {
      id: user.id,
      fullName: user.fullName,
      email: user.email,
      role: user.role,
      phone: user.phone,
    };
  } catch (dbError) {
    await axios.delete(
      `${keycloakConfig.adminBaseUrl}/users/${keycloakUserId}`,
      { headers: { Authorization: `Bearer ${adminToken}` } }
    );
    throw new Error('failed to create local user record');
  }
}

// autentica al usuario via keycloak usando resource owner password credentials grant
export async function loginUser(input: LoginInput) {
  const params = new URLSearchParams({
    grant_type: 'password',
    client_id: keycloakConfig.clientId,
    client_secret: keycloakConfig.clientSecret,
    username: input.email,
    password: input.password,
  });

  const response = await axios.post(keycloakConfig.tokenUrl, params, {
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  });

  return {
    accessToken: response.data.access_token,
    refreshToken: response.data.refresh_token,
    expiresIn: response.data.expires_in,
    tokenType: response.data.token_type,
  };
}
