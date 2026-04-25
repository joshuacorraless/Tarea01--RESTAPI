import { randomUUID } from 'crypto';
import mongoose, { HydratedDocument, Schema } from 'mongoose';

export interface IRestaurant {
  _id: string;
  name: string;
  description: string | null;
  address: string;
  phone: string | null;
  openingHours: string | null;
  adminUserId: string;
  deletedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const restaurantSchema = new Schema<IRestaurant>(
  {
    _id: { type: String, default: () => randomUUID() },
    name: { type: String, required: true },
    description: { type: String, default: null },
    address: { type: String, required: true },
    phone: { type: String, default: null },
    openingHours: { type: String, default: null },
    adminUserId: { type: String, required: true, index: true },
    deletedAt: { type: Date, default: null },
  },
  { timestamps: true },
);

export type RestaurantDocument = HydratedDocument<IRestaurant>;
export const RestaurantModel = mongoose.model<IRestaurant>('Restaurant', restaurantSchema);
