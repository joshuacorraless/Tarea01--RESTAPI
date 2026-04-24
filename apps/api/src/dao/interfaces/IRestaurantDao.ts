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

// variante del listado que ya incluye el join con la info publica del admin
// se separa del create porque sp_create_restaurant no retorna admin_name/email
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
