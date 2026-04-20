import { dao } from '../dao/DaoFactory';
import { UpdateUserInput } from '../schemas/user.schema';

// obtiene el usuario local por su external_auth_id (sub del jwt de keycloak)
export async function getUserByExternalId(externalAuthId: string) {
  const user = await dao.users.getByExternalId(externalAuthId);

  if (!user) {
    throw new Error('user not found');
  }

  return {
    id: user.id,
    fullName: user.fullName,
    email: user.email,
    role: user.role,
    phone: user.phone,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
}

// actualiza el perfil del usuario - solo permite modificar el propio
export async function updateUser(userId: string, externalAuthId: string, input: UpdateUserInput) {
  const existing = await dao.users.getById(userId);

  if (!existing) {
    throw new Error('user not found');
  }

  // verificar que el usuario autenticado es el dueño del recurso
  if (existing.externalAuthId !== externalAuthId) {
    throw new Error('forbidden: you can only update your own profile');
  }

  const user = await dao.users.update(userId, input);

  // el sp responde con filas solo si existe y no esta eliminado; aqui
  // ya lo validamos arriba, asi que user es no-null en el camino feliz
  return {
    id: user!.id,
    fullName: user!.fullName,
    email: user!.email,
    role: user!.role,
    phone: user!.phone,
    updatedAt: user!.updatedAt,
  };
}

// soft delete del usuario - solo permite eliminar el propio
export async function softDeleteUser(userId: string, externalAuthId: string) {
  const existing = await dao.users.getById(userId);

  if (!existing) {
    throw new Error('user not found');
  }

  if (existing.externalAuthId !== externalAuthId) {
    throw new Error('forbidden: you can only delete your own account');
  }

  await dao.users.softDelete(userId);
}
