import { isDomainError } from '@flota/domain';
import { PROTOCOL_VERSION } from '@flota/protocol';
import cors from '@fastify/cors';
import websocket from '@fastify/websocket';
import { sql } from 'drizzle-orm';
import Fastify from 'fastify';
import { ZodError } from 'zod';

import { authRoutes } from './auth/routes.js';
import type { AppDeps } from './deps.js';
import { isAppError } from './errors.js';
import { createGameService } from './game/service.js';
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

export async function buildApp(deps: AppDeps) {
  const app = Fastify({ loggerInstance: deps.logger });

  await app.register(cors, { origin: true });
  await app.register(websocket);

  const hub = createConnectionHub();
  const service = createGameService(deps);

  await app.register(authRoutes(deps), { prefix: '/api' });
  await app.register(wsRoutes(deps, hub, service));

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
    };
  });

  app.setErrorHandler((error, request, reply) => {
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
    request.log.error({ err: error }, 'unhandled error');
    return reply.code(500).send({ error: { code: 'INTERNAL', message: 'internal error' } });
  });

  return app;
}
