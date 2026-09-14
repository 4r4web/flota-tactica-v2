import {
  ChangePasswordRequest,
  ForgotPasswordRequest,
  LoginRequest,
  RefreshRequest,
  RegisterRequest,
  ResetPasswordRequest,
  UpdateProfileRequest,
} from '@flota/protocol';
import type { FastifyPluginAsync, FastifyRequest } from 'fastify';

import type { Config } from '../config.js';
import type { AppDeps } from '../deps.js';
import { authenticateRequest } from './authenticate.js';
import { createMailer } from './mailer.js';
import { createAuthService } from './service.js';

function baseUrlFromRequest(request: FastifyRequest, config: Config): string {
  if (config.appBaseUrl !== undefined && config.appBaseUrl !== '') {
    return config.appBaseUrl.replace(/\/+$/, '');
  }
  const forwardedProto = request.headers['x-forwarded-proto'];
  const forwardedHost = request.headers['x-forwarded-host'];
  const proto =
    (typeof forwardedProto === 'string' ? forwardedProto.split(',')[0]?.trim() : undefined) ??
    request.protocol;
  const host =
    (typeof forwardedHost === 'string' ? forwardedHost.split(',')[0]?.trim() : undefined) ??
    request.headers.host ??
    'localhost';
  return `${proto}://${host}`;
}

export function authRoutes(deps: AppDeps): FastifyPluginAsync {
  const mailer = createMailer(deps.config, deps.logger);
  const service = createAuthService(deps.db, deps.tokens, mailer, deps.config);
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

    app.post('/auth/forgot-password', strictRateLimit, async (request, reply) => {
      const input = ForgotPasswordRequest.parse(request.body);
      await service.forgotPassword(input.email, baseUrlFromRequest(request, deps.config));
      return reply.code(204).send();
    });

    app.post('/auth/reset-password', strictRateLimit, async (request, reply) => {
      const input = ResetPasswordRequest.parse(request.body);
      await service.resetPassword(input.token, input.newPassword);
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

    app.post('/me/password', strictRateLimit, async (request, reply) => {
      const userId = await authenticateRequest(request, deps.tokens);
      const input = ChangePasswordRequest.parse(request.body);
      await service.changePassword(userId, input.currentPassword, input.newPassword);
      return reply.code(204).send();
    });

    app.delete('/me', async (request, reply) => {
      const userId = await authenticateRequest(request, deps.tokens);
      await service.deleteAccount(userId);
      return reply.code(204).send();
    });
  };
}
