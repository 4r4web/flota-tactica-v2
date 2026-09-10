import { pino } from 'pino';

import type { Config } from '../config.js';

export type Logger = ReturnType<typeof createLogger>;

export function createLogger(config: Pick<Config, 'nodeEnv'>) {
  return pino({
    level: config.nodeEnv === 'test' ? 'silent' : 'info',
    base: undefined,
  });
}
