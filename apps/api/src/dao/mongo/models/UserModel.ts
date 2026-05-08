import { randomUUID } from 'crypto';
import mongoose, { HydratedDocument, Schema } from 'mongoose';

export interface IUser {
  _id: string;
  fullName: string;
  email: string;
  externalAuthId: string;
  role: 'client' | 'restaurant_admin';
  phone: string | null;
  deletedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const userSchema = new Schema<IUser>(
  {
    _id: { type: String, default: () => randomUUID() },
    fullName: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    externalAuthId: { type: String, required: true, unique: true, index: true },
    role: { type: String, enum: ['client', 'restaurant_admin'], required: true },
    phone: { type: String, default: null },
    deletedAt: { type: Date, default: null },
  },
  { timestamps: true },
);

export type UserDocument = HydratedDocument<IUser>;
export const UserModel = mongoose.model<IUser>('User', userSchema);
