import { UpdateUserInput } from '../../schemas/user.schema';
import {
  CreateUserData,
  IUserDao,
  UserRecord,
} from '../interfaces/IUserDao';
import { UserDocument, UserModel } from './models/UserModel';

function mapUser(doc: UserDocument): UserRecord {
  return {
    id: doc._id,
    fullName: doc.fullName,
    email: doc.email,
    externalAuthId: doc.externalAuthId,
    role: doc.role,
    phone: doc.phone,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  };
}

export class MongoUserDao implements IUserDao {
  async create(data: CreateUserData): Promise<UserRecord> {
    const doc = await UserModel.create({
      fullName: data.fullName,
      email: data.email,
      externalAuthId: data.externalAuthId,
      role: data.role,
      phone: data.phone ?? null,
    });
    return mapUser(doc);
  }

  async getByExternalId(externalAuthId: string): Promise<UserRecord | null> {
    const doc = await UserModel.findOne({ externalAuthId, deletedAt: null });
    if (!doc) return null;
    return mapUser(doc);
  }

  async getById(id: string): Promise<UserRecord | null> {
    const doc = await UserModel.findOne({ _id: id, deletedAt: null });
    if (!doc) return null;
    return mapUser(doc);
  }

  async update(id: string, input: UpdateUserInput): Promise<UserRecord | null> {
    const updates: Partial<UserDocument> = {};
    if (input.fullName !== undefined) updates.fullName = input.fullName;
    if (input.phone !== undefined) updates.phone = input.phone ?? null;

    const doc = await UserModel.findOneAndUpdate(
      { _id: id, deletedAt: null },
      { $set: updates },
      { new: true },
    );
    if (!doc) return null;
    return mapUser(doc);
  }

  async softDelete(id: string): Promise<void> {
    await UserModel.findOneAndUpdate(
      { _id: id, deletedAt: null },
      { $set: { deletedAt: new Date() } },
    );
  }
}
