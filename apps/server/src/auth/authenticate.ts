import type { FastifyRequest } from 'fastify';

import { AppError } from '../errors.js';
import type { TokenService } from './tokens.js';

export async function authenticateToken(token: string, tokens: TokenService): Promise<string> {
  try {
    const { userId } = await tokens.verifyAccessToken(token);
    return userId;
  } catch {
    throw new AppError(401, 'TOKEN_EXPIRED', 'invalid or expired token');
  }
}

export async function authenticateRequest(
  request: FastifyRequest,
  tokens: TokenService,
): Promise<string> {
  const header = request.headers.authorization;
  if (header === undefined || !header.startsWith('Bearer ')) {
    throw new AppError(401, 'AUTH_REQUIRED', 'missing bearer token');
  }
  return authenticateToken(header.slice('Bearer '.length), tokens);
}
