import { dao } from '../dao/DaoFactory';
import { UpdateUserInput } from '../schemas/user.schema';

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

export async function updateUser(userId: string, externalAuthId: string, input: UpdateUserInput) {
  const existing = await dao.users.getById(userId);

  if (!existing) {
    throw new Error('user not found');
  }

  // solo el dueño puede modificar su propio perfil
  if (existing.externalAuthId !== externalAuthId) {
    throw new Error('forbidden: you can only update your own profile');
  }

  const user = await dao.users.update(userId, input);

  return {
    id: user!.id,
    fullName: user!.fullName,
    email: user!.email,
    role: user!.role,
    phone: user!.phone,
    updatedAt: user!.updatedAt,
  };
}

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
