import {
  LoginRequest,
  RefreshRequest,
  RegisterRequest,
  UpdateProfileRequest,
} from '@flota/protocol';
import type { FastifyPluginAsync } from 'fastify';

import type { AppDeps } from '../deps.js';
import { authenticateRequest } from './authenticate.js';
import { createAuthService } from './service.js';

export function authRoutes(deps: AppDeps): FastifyPluginAsync {
  const service = createAuthService(deps.db, deps.tokens);
  const strictRateLimit = {
    config: {
      rateLimit: {
        max: deps.config.authRateLimitMax,
        timeWindow: deps.config.rateLimitWindow,
      },
    },
  };

  return async (app) => {
    app.post('/auth/register', strictRateLimit, async (request, reply) => {
      const input = RegisterRequest.parse(request.body);
      const result = await service.register(input, request.headers['user-agent']);
      return reply.code(201).send(result);
    });

    app.post('/auth/login', strictRateLimit, async (request) => {
      const input = LoginRequest.parse(request.body);
      return service.login(input, request.headers['user-agent']);
    });

    app.post('/auth/refresh', strictRateLimit, async (request) => {
      const input = RefreshRequest.parse(request.body);
      return service.refresh(input.refreshToken, request.headers['user-agent']);
    });

    app.post('/auth/logout', async (request, reply) => {
      const input = RefreshRequest.parse(request.body);
      await service.logout(input.refreshToken);
      return reply.code(204).send();
    });

    app.get('/me', async (request) => {
      const userId = await authenticateRequest(request, deps.tokens);
      return service.getProfile(userId);
    });

    app.patch('/me', async (request) => {
      const userId = await authenticateRequest(request, deps.tokens);
      const input = UpdateProfileRequest.parse(request.body);
      return service.updateProfile(userId, input.displayName);
    });

    app.delete('/me', async (request, reply) => {
      const userId = await authenticateRequest(request, deps.tokens);
      await service.deleteAccount(userId);
      return reply.code(204).send();
    });
  };
}
