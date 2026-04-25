import {
  CreateRestaurantData,
  IRestaurantDao,
  RestaurantRecord,
  RestaurantWithAdminRecord,
} from '../interfaces/IRestaurantDao';
import { RestaurantDocument, RestaurantModel } from './models/RestaurantModel';

function mapRestaurant(doc: RestaurantDocument): RestaurantRecord {
  return {
    id: doc._id,
    name: doc.name,
    description: doc.description,
    address: doc.address,
    phone: doc.phone,
    openingHours: doc.openingHours,
    adminUserId: doc.adminUserId,
    createdAt: doc.createdAt,
  };
}

export class MongoRestaurantDao implements IRestaurantDao {
  async create(data: CreateRestaurantData): Promise<RestaurantRecord> {
    const doc = await RestaurantModel.create({
      name: data.name,
      description: data.description ?? null,
      address: data.address,
      phone: data.phone ?? null,
      openingHours: data.openingHours ?? null,
      adminUserId: data.adminUserId,
    });
    return mapRestaurant(doc);
  }

  async list(): Promise<RestaurantWithAdminRecord[]> {
    const docs = await RestaurantModel.aggregate([
      { $match: { deletedAt: null } },
      {
        $lookup: {
          from: 'users',
          localField: 'adminUserId',
          foreignField: '_id',
          as: 'adminUserDoc',
        },
      },
      { $unwind: '$adminUserDoc' },
      { $sort: { createdAt: -1 } },
    ]);

    return docs.map((doc) => ({
      id: doc._id,
      name: doc.name,
      description: doc.description ?? null,
      address: doc.address,
      phone: doc.phone ?? null,
      openingHours: doc.openingHours ?? null,
      adminUserId: doc.adminUserId,
      createdAt: doc.createdAt,
      updatedAt: doc.updatedAt,
      adminUser: {
        fullName: doc.adminUserDoc.fullName,
        email: doc.adminUserDoc.email,
      },
    }));
  }
}
