import { isDomainError } from '@flota/domain';
import { PROTOCOL_VERSION } from '@flota/protocol';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import websocket from '@fastify/websocket';
import { sql } from 'drizzle-orm';
import Fastify from 'fastify';
import type { FastifyError } from 'fastify';
import { ZodError } from 'zod';

import { authRoutes } from './auth/routes.js';
import type { AppDeps } from './deps.js';
import { isAppError } from './errors.js';
import { createGameService } from './game/service.js';
import { createMetrics } from './infra/metrics.js';
import { APP_VERSION } from './version.js';
import { createConnectionHub } from './ws/connections.js';
import { wsRoutes } from './ws/gateway.js';

function isZodError(error: unknown): boolean {
  return (
    error instanceof ZodError ||
    (typeof error === 'object' &&
      error !== null &&
      (error as { name?: string }).name === 'ZodError')
  );
}

function corsOrigin(value: string): true | string[] {
  return value === '*' ? true : value.split(',').map((origin) => origin.trim());
}

function errorCodeForStatus(status: number): string {
  if (status === 429) {
    return 'RATE_LIMITED';
  }
  if (status === 413) {
    return 'MESSAGE_TOO_LARGE';
  }
  return 'INVALID_ACTION';
}

function statusOf(error: unknown): number | null {
  const status = (error as { statusCode?: unknown }).statusCode;
  return typeof status === 'number' ? status : null;
}

export async function buildApp(deps: AppDeps) {
  const app = Fastify({
    loggerInstance: deps.logger,
    bodyLimit: deps.config.bodyLimit,
  });
  const metrics = createMetrics();

  app.setErrorHandler((error: FastifyError, request, reply) => {
    if (isAppError(error)) {
      return reply
        .code(error.statusCode)
        .send({ error: { code: error.code, message: error.message } });
    }
    if (isZodError(error)) {
      return reply
        .code(400)
        .send({ error: { code: 'INVALID_ACTION', message: 'invalid request payload' } });
    }
    if (isDomainError(error)) {
      return reply.code(400).send({ error: { code: 'INVALID_ACTION', message: error.message } });
    }
    const status = statusOf(error);
    if (status !== null && status >= 400 && status < 500) {
      return reply
        .code(status)
        .send({ error: { code: errorCodeForStatus(status), message: error.message } });
    }
    request.log.error({ err: error }, 'unhandled error');
    return reply.code(500).send({ error: { code: 'INTERNAL', message: 'internal error' } });
  });

  await app.register(helmet, { contentSecurityPolicy: false });
  await app.register(cors, { origin: corsOrigin(deps.config.corsOrigin) });
  await app.register(rateLimit, {
    global: true,
    max: deps.config.rateLimitMax,
    timeWindow: deps.config.rateLimitWindow,
  });
  await app.register(websocket);

  const hub = createConnectionHub();
  const service = createGameService(deps, metrics);

  await app.register(authRoutes(deps), { prefix: '/api' });
  await app.register(wsRoutes(deps, hub, service, metrics));

  app.addHook('onResponse', (request, reply, done) => {
    metrics.httpRequests.inc({
      method: request.method,
      route: request.routeOptions?.url ?? 'unknown',
      status: String(reply.statusCode),
    });
    done();
  });

  app.get('/health', async () => {
    let postgres = 'ok';
    let redis = 'ok';
    try {
      await deps.db.execute(sql`select 1`);
    } catch {
      postgres = 'down';
    }
    try {
      await deps.redis.ping();
    } catch {
      redis = 'down';
    }
    return {
      status: postgres === 'ok' && redis === 'ok' ? 'ok' : 'degraded',
      postgres,
      redis,
      protocol: PROTOCOL_VERSION,
      version: APP_VERSION,
      uptime: Math.round(process.uptime()),
    };
  });

  app.get('/metrics', async (_request, reply) => {
    reply.header('content-type', metrics.registry.contentType);
    return metrics.registry.metrics();
  });

  return app;
}
