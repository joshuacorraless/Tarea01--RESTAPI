import mongoose from 'mongoose';
import { env } from './env';

export async function connectMongo(): Promise<void> {
  if (!env.MONGODB_URI) {
    throw new Error('MONGODB_URI es requerida cuando DB_ENGINE=mongo');
  }
  await mongoose.connect(env.MONGODB_URI, {
    replicaSet: env.MONGO_REPLICA_SET || undefined,
    readPreference: 'primaryPreferred',
  });
  console.log('conectado a mongodb');
}
