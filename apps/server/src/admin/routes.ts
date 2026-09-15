import type { FastifyPluginAsync, FastifyRequest } from 'fastify';

import { authenticateRequest } from '../auth/authenticate.js';
import type { AppDeps } from '../deps.js';
import { AppError } from '../errors.js';
import { createAdminService } from './service.js';

export function adminRoutes(deps: AppDeps): FastifyPluginAsync {
  const service = createAdminService(deps.db, deps.config.adminEmail);

  async function requireAdmin(request: FastifyRequest): Promise<void> {
    const userId = await authenticateRequest(request, deps.tokens);
    if (!(await service.isAdmin(userId))) {
      throw new AppError(403, 'AUTH_REQUIRED', 'admin access required');
    }
  }

  return async (app) => {
    app.get('/admin/matches', async (request) => {
      await requireAdmin(request);
      const raw = (request.query as { limit?: string }).limit;
      const parsed = Number(raw);
      const limit = Number.isFinite(parsed) ? Math.min(Math.max(parsed, 1), 200) : 50;
      return { matches: await service.listMatches(limit) };
    });

    app.get('/admin/matches/:gameId/events', async (request) => {
      await requireAdmin(request);
      const { gameId } = request.params as { gameId: string };
      return { events: await service.listEvents(gameId) };
    });
  };
}
