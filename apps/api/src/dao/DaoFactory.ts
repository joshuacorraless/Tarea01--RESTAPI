import { env } from '../config/env';
import { IMenuDao } from './interfaces/IMenuDao';
import { IMenuItemDao } from './interfaces/IMenuItemDao';
import { IOrderDao } from './interfaces/IOrderDao';
import { IReservationDao } from './interfaces/IReservationDao';
import { IRestaurantDao } from './interfaces/IRestaurantDao';
import { IUserDao } from './interfaces/IUserDao';
import { PostgresMenuDao } from './postgres/PostgresMenuDao';
import { PostgresMenuItemDao } from './postgres/PostgresMenuItemDao';
import { PostgresOrderDao } from './postgres/PostgresOrderDao';
import { PostgresReservationDao } from './postgres/PostgresReservationDao';
import { PostgresRestaurantDao } from './postgres/PostgresRestaurantDao';
import { PostgresUserDao } from './postgres/PostgresUserDao';

// conjunto completo de DAOs que el resto de la app consume
// agregar un agregado nuevo => una propiedad mas aqui y una entrada por motor
export interface DaoRegistry {
  users: IUserDao;
  restaurants: IRestaurantDao;
  menus: IMenuDao;
  menuItems: IMenuItemDao;
  reservations: IReservationDao;
  orders: IOrderDao;
}

// un builder por motor; agregar mongo => una entrada mas en el mapa
// sin tocar services ni factory ni otros motores
type DaoEngine = 'postgres' | 'mongo';

const builders: Record<DaoEngine, () => DaoRegistry> = {
  postgres: () => ({
    users: new PostgresUserDao(),
    restaurants: new PostgresRestaurantDao(),
    menus: new PostgresMenuDao(),
    menuItems: new PostgresMenuItemDao(),
    reservations: new PostgresReservationDao(),
    orders: new PostgresOrderDao(),
  }),
  mongo: () => {
    // stub hasta que exista src/dao/mongo con las implementaciones
    throw new Error('adaptador mongo no implementado aun');
  },
};

// punto unico de seleccion del motor de persistencia
// un unico lookup en el mapa; no hay cadenas de if por agregado
export const dao: DaoRegistry = builders[env.DB_ENGINE]();
