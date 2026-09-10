import { createHash, randomBytes } from 'node:crypto';

import { jwtVerify, SignJWT } from 'jose';

import type { Config } from '../config.js';

export interface TokenService {
  signAccessToken(userId: string): Promise<string>;
  verifyAccessToken(token: string): Promise<{ userId: string }>;
  createRefreshToken(): string;
  hashRefreshToken(token: string): string;
  refreshExpiry(): Date;
}

export function createTokenService(config: Config): TokenService {
  const secret = new TextEncoder().encode(config.jwtSecret);

  return {
    signAccessToken(userId) {
      return new SignJWT({})
        .setProtectedHeader({ alg: 'HS256' })
        .setSubject(userId)
        .setIssuedAt()
        .setExpirationTime(`${config.accessTokenTtl}s`)
        .sign(secret);
    },

    async verifyAccessToken(token) {
      const { payload } = await jwtVerify(token, secret);
      if (typeof payload.sub !== 'string') {
        throw new Error('token is missing a subject');
      }
      return { userId: payload.sub };
    },

    createRefreshToken() {
      return randomBytes(32).toString('base64url');
    },

    hashRefreshToken(token) {
      return createHash('sha256').update(token).digest('hex');
    },

    refreshExpiry() {
      return new Date(Date.now() + config.refreshTokenTtl * 1000);
    },
  };
}
