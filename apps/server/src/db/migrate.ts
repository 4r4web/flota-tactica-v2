import { fileURLToPath } from 'node:url';

import { migrate } from 'drizzle-orm/postgres-js/migrator';

import { loadConfig } from '../config.js';
import { createDb } from '../infra/db.js';

async function main(): Promise<void> {
  try {
    process.loadEnvFile();
  } catch {
    // No .env file present; rely on the process environment.
  }

  const config = loadConfig();
  const database = createDb(config.databaseUrl);

  await migrate(database.db, {
    migrationsFolder: fileURLToPath(new URL('../../drizzle', import.meta.url)),
  });
  await database.close();
  process.stdout.write('migrations applied\n');
}

void main().catch((error: unknown) => {
  process.stderr.write(`${String(error)}\n`);
  process.exit(1);
});
