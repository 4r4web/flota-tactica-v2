import type { Config } from './config.js';
import type { Database } from './infra/db.js';
import type { Logger } from './infra/logger.js';
import type { RedisClient } from './infra/redis.js';
import type { TokenService } from './auth/tokens.js';

export interface AppDeps {
  config: Config;
  db: Database;
  redis: RedisClient;
  logger: Logger;
  tokens: TokenService;
}
