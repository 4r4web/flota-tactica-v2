import { buildApp } from './app.js';
import { createTokenService } from './auth/tokens.js';
import { loadConfig } from './config.js';
import { createDb } from './infra/db.js';
import { createLogger } from './infra/logger.js';
import { createRedis } from './infra/redis.js';

async function main(): Promise<void> {
  try {
    process.loadEnvFile();
  } catch {
    // No .env file present; rely on the process environment.
  }

  const config = loadConfig();
  const logger = createLogger(config);
  const database = createDb(config.databaseUrl);
  const redis = createRedis(config.redisUrl);
  const tokens = createTokenService(config);

  const app = await buildApp({ config, db: database.db, redis, logger, tokens });

  await app.listen({ port: config.port, host: '0.0.0.0' });

  const shutdown = async (signal: string): Promise<void> => {
    logger.info({ signal }, 'shutting down');
    await app.close();
    await database.close();
    redis.disconnect();
    process.exit(0);
  };

  process.on('SIGINT', () => void shutdown('SIGINT'));
  process.on('SIGTERM', () => void shutdown('SIGTERM'));
}

void main();
