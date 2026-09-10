import { pino } from 'pino';

import type { Config } from '../config.js';

export type Logger = ReturnType<typeof createLogger>;

export function createLogger(config: Pick<Config, 'nodeEnv'>) {
  return pino({
    level: config.nodeEnv === 'test' ? 'silent' : 'info',
    base: undefined,
    redact: {
      paths: [
        'req.headers.authorization',
        'req.headers.cookie',
        'password',
        '*.password',
        'accessToken',
        'refreshToken',
      ],
      censor: '[redacted]',
    },
  });
}
