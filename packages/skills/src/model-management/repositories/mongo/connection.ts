import { MongoClient, type Db } from 'mongodb';

export type { Db as MongoDb };
export { MongoClient };

export function createMongoClient(connectionString: string): MongoClient {
  return new MongoClient(connectionString, {
    maxPoolSize: 10,
    minPoolSize: 2,
    connectTimeoutMS: 5000,
    serverSelectionTimeoutMS: 5000,
  });
}
