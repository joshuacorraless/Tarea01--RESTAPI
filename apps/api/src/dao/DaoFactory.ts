import { env } from '../config/env';
import type { IMenuDao } from './interfaces/IMenuDao';
import type { IMenuItemDao } from './interfaces/IMenuItemDao';
import type { IOrderDao } from './interfaces/IOrderDao';
import type { IReservationDao } from './interfaces/IReservationDao';
import type { IRestaurantDao } from './interfaces/IRestaurantDao';
import type { IUserDao } from './interfaces/IUserDao';

export interface DaoRegistry {
  users: IUserDao;
  restaurants: IRestaurantDao;
  menus: IMenuDao;
  menuItems: IMenuItemDao;
  reservations: IReservationDao;
  orders: IOrderDao;
}

export async function initDaoEngine(): Promise<void> {
  if (env.DB_ENGINE === 'mongo') {
    const { connectMongo } = require('../config/database.mongo');
    await connectMongo();
  } else {
    const { connectPostgres } = require('../config/database');
    await connectPostgres();
  }
}

export const dao: DaoRegistry = (() => {
  if (env.DB_ENGINE === 'mongo') {
    const { MongoUserDao } = require('./mongo/MongoUserDao');
    const { MongoRestaurantDao } = require('./mongo/MongoRestaurantDao');
    const { MongoMenuDao } = require('./mongo/MongoMenuDao');
    const { MongoMenuItemDao } = require('./mongo/MongoMenuItemDao');
    const { MongoReservationDao } = require('./mongo/MongoReservationDao');
    const { MongoOrderDao } = require('./mongo/MongoOrderDao');
    return {
      users: new MongoUserDao(),
      restaurants: new MongoRestaurantDao(),
      menus: new MongoMenuDao(),
      menuItems: new MongoMenuItemDao(),
      reservations: new MongoReservationDao(),
      orders: new MongoOrderDao(),
    };
  }

  const { PostgresUserDao } = require('./postgres/PostgresUserDao');
  const { PostgresRestaurantDao } = require('./postgres/PostgresRestaurantDao');
  const { PostgresMenuDao } = require('./postgres/PostgresMenuDao');
  const { PostgresMenuItemDao } = require('./postgres/PostgresMenuItemDao');
  const { PostgresReservationDao } = require('./postgres/PostgresReservationDao');
  const { PostgresOrderDao } = require('./postgres/PostgresOrderDao');
  return {
    users: new PostgresUserDao(),
    restaurants: new PostgresRestaurantDao(),
    menus: new PostgresMenuDao(),
    menuItems: new PostgresMenuItemDao(),
    reservations: new PostgresReservationDao(),
    orders: new PostgresOrderDao(),
  };
})();
