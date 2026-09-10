import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';

import * as schema from '../db/schema.js';

export type Database = ReturnType<typeof createDb>['db'];

export function createDb(url: string) {
  const client = postgres(url, { max: 10 });
  const db = drizzle(client, { schema });
  return {
    db,
    client,
    close: () => client.end({ timeout: 5 }),
  };
}
