import { UpdateUserInput } from '../../schemas/user.schema';

// rol sincronizado con el enum user_role en postgres
export type UserRole = 'client' | 'restaurant_admin';

// representacion en camelcase del registro de users devuelto por los sp
// se guarda externalAuthId aparte porque los services lo necesitan
// para validar ownership antes de exponer dtos publicos
export interface UserRecord {
  id: string;
  fullName: string;
  email: string;
  externalAuthId: string;
  role: UserRole;
  phone: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateUserData {
  fullName: string;
  email: string;
  externalAuthId: string;
  role: UserRole;
  phone?: string | null;
}

// contrato DAO para persistencia de usuarios locales
// el registro en keycloak vive fuera de este contrato a proposito
export interface IUserDao {
  create(data: CreateUserData): Promise<UserRecord>;
  getByExternalId(externalAuthId: string): Promise<UserRecord | null>;
  getById(id: string): Promise<UserRecord | null>;
  update(id: string, input: UpdateUserInput): Promise<UserRecord | null>;
  softDelete(id: string): Promise<void>;
}
