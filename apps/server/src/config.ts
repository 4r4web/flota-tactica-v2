import { z } from 'zod';

const EnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(3000),
  DATABASE_URL: z.string().min(1),
  REDIS_URL: z.string().min(1),
  JWT_SECRET: z.string().min(16),
  ACCESS_TOKEN_TTL: z.coerce.number().int().positive().default(900),
  REFRESH_TOKEN_TTL: z.coerce.number().int().positive().default(604_800),
  CORS_ORIGIN: z.string().default('*'),
  RATE_LIMIT_MAX: z.coerce.number().int().positive().default(120),
  RATE_LIMIT_WINDOW: z.string().default('1 minute'),
  AUTH_RATE_LIMIT_MAX: z.coerce.number().int().positive().default(10),
  BODY_LIMIT: z.coerce.number().int().positive().default(16_384),
});

export interface Config {
  nodeEnv: 'development' | 'test' | 'production';
  port: number;
  databaseUrl: string;
  redisUrl: string;
  jwtSecret: string;
  accessTokenTtl: number;
  refreshTokenTtl: number;
  corsOrigin: string;
  rateLimitMax: number;
  rateLimitWindow: string;
  authRateLimitMax: number;
  bodyLimit: number;
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const parsed = EnvSchema.safeParse(env);
  if (!parsed.success) {
    throw new Error(`Invalid environment configuration: ${parsed.error.message}`);
  }
  const value = parsed.data;
  return {
    nodeEnv: value.NODE_ENV,
    port: value.PORT,
    databaseUrl: value.DATABASE_URL,
    redisUrl: value.REDIS_URL,
    jwtSecret: value.JWT_SECRET,
    accessTokenTtl: value.ACCESS_TOKEN_TTL,
    refreshTokenTtl: value.REFRESH_TOKEN_TTL,
    corsOrigin: value.CORS_ORIGIN,
    rateLimitMax: value.RATE_LIMIT_MAX,
    rateLimitWindow: value.RATE_LIMIT_WINDOW,
    authRateLimitMax: value.AUTH_RATE_LIMIT_MAX,
    bodyLimit: value.BODY_LIMIT,
  };
}
