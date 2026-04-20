import { dao } from '../dao/DaoFactory';
import { CreateRestaurantInput } from '../schemas/restaurant.schema';

// crea un restaurante vinculado al admin autenticado
export async function createRestaurant(adminExternalId: string, input: CreateRestaurantInput) {
  // resolver el id local del admin antes de persistir el restaurante
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

// lista todos los restaurantes activos (no eliminados) con info del admin
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
