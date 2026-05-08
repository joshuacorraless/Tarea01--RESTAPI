import { CreateRestaurantInput } from '../../schemas/restaurant.schema';

export interface RestaurantRecord {
  id: string;
  name: string;
  description: string | null;
  address: string;
  phone: string | null;
  openingHours: string | null;
  adminUserId: string;
  createdAt: Date;
  updatedAt?: Date;
}

// el listado incluye join con users; el create no lo trae, por eso son tipos separados
export interface RestaurantWithAdminRecord extends RestaurantRecord {
  updatedAt: Date;
  adminUser: {
    fullName: string;
    email: string;
  };
}

export interface CreateRestaurantData extends CreateRestaurantInput {
  adminUserId: string;
}

export interface IRestaurantDao {
  create(data: CreateRestaurantData): Promise<RestaurantRecord>;
  list(): Promise<RestaurantWithAdminRecord[]>;
}
