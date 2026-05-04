import { UpdateUserInput } from '../../schemas/user.schema';

// debe coincidir con el enum user_role en postgres
export type UserRole = 'client' | 'restaurant_admin';

// externalAuthId se guarda aparte porque los services lo usan
// para validar ownership antes de exponer los dtos publicos
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

// el registro en keycloak no vive aca a proposito, este dao es solo para la base local
export interface IUserDao {
  create(data: CreateUserData): Promise<UserRecord>;
  getByExternalId(externalAuthId: string): Promise<UserRecord | null>;
  getById(id: string): Promise<UserRecord | null>;
  update(id: string, input: UpdateUserInput): Promise<UserRecord | null>;
  softDelete(id: string): Promise<void>;
}
