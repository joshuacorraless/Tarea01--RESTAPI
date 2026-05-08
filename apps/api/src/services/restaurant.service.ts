import { dao } from '../dao/DaoFactory';
import { CreateRestaurantInput } from '../schemas/restaurant.schema';

export async function createRestaurant(adminExternalId: string, input: CreateRestaurantInput) {
  const adminUser = await dao.users.getByExternalId(adminExternalId);

  if (!adminUser) {
    throw new Error('admin user not found');
  }

  const restaurant = await dao.restaurants.create({
    ...input,
    adminUserId: adminUser.id,
  });

  return {
    id: restaurant.id,
    name: restaurant.name,
    description: restaurant.description,
    address: restaurant.address,
    phone: restaurant.phone,
    openingHours: restaurant.openingHours,
    adminUserId: restaurant.adminUserId,
    createdAt: restaurant.createdAt,
  };
}

export async function listRestaurants() {
  const restaurants = await dao.restaurants.list();

  return restaurants.map((r) => ({
    id: r.id,
    name: r.name,
    description: r.description,
    address: r.address,
    phone: r.phone,
    openingHours: r.openingHours,
    adminUserId: r.adminUserId,
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
    adminUser: r.adminUser,
  }));
}
