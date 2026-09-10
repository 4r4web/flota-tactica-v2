import { and, eq, isNull } from 'drizzle-orm';

import { refreshTokens, users } from '../db/schema.js';
import { AppError } from '../errors.js';
import type { Database } from '../infra/db.js';
import { hashPassword, verifyPassword } from './password.js';
import type { TokenService } from './tokens.js';

export interface UserProfile {
  id: string;
  email: string;
  displayName: string;
  createdAt: string;
}

export interface AuthResult {
  user: UserProfile;
  accessToken: string;
  refreshToken: string;
}

export interface RegisterInput {
  email: string;
  password: string;
  displayName: string;
}

export interface LoginInput {
  email: string;
  password: string;
}

export interface AuthService {
  register(input: RegisterInput, userAgent?: string): Promise<AuthResult>;
  login(input: LoginInput, userAgent?: string): Promise<AuthResult>;
  refresh(refreshToken: string, userAgent?: string): Promise<AuthResult>;
  logout(refreshToken: string): Promise<void>;
  getProfile(userId: string): Promise<UserProfile>;
  updateProfile(userId: string, displayName: string): Promise<UserProfile>;
  deleteAccount(userId: string): Promise<void>;
}

type UserRow = typeof users.$inferSelect;

function toProfile(user: UserRow): UserProfile {
  return {
    id: user.id,
    email: user.email,
    displayName: user.displayName,
    createdAt: user.createdAt.toISOString(),
  };
}

export function createAuthService(db: Database, tokens: TokenService): AuthService {
  async function issue(
    userId: string,
    userAgent?: string,
  ): Promise<{ accessToken: string; refreshToken: string }> {
    const accessToken = await tokens.signAccessToken(userId);
    const refreshToken = tokens.createRefreshToken();
    await db.insert(refreshTokens).values({
      userId,
      tokenHash: tokens.hashRefreshToken(refreshToken),
      expiresAt: tokens.refreshExpiry(),
      userAgent: userAgent ?? null,
    });
    return { accessToken, refreshToken };
  }

  return {
    async register(input, userAgent) {
      const email = input.email.toLowerCase();
      const existing = await db.select().from(users).where(eq(users.email, email)).limit(1);
      if (existing.length > 0) {
        throw new AppError(409, 'EMAIL_TAKEN', 'email is already registered');
      }
      const passwordHash = await hashPassword(input.password);
      const inserted = await db
        .insert(users)
        .values({ email, passwordHash, displayName: input.displayName })
        .returning();
      const user = inserted[0];
      if (user === undefined) {
        throw new AppError(500, 'INTERNAL', 'could not create user');
      }
      const issued = await issue(user.id, userAgent);
      return { user: toProfile(user), ...issued };
    },

    async login(input, userAgent) {
      const email = input.email.toLowerCase();
      const found = await db.select().from(users).where(eq(users.email, email)).limit(1);
      const user = found[0];
      if (user === undefined || user.passwordHash === null || user.deletedAt !== null) {
        throw new AppError(401, 'AUTH_INVALID', 'invalid credentials');
      }
      const valid = await verifyPassword(user.passwordHash, input.password);
      if (!valid) {
        throw new AppError(401, 'AUTH_INVALID', 'invalid credentials');
      }
      const issued = await issue(user.id, userAgent);
      return { user: toProfile(user), ...issued };
    },

    async refresh(refreshToken, userAgent) {
      const tokenHash = tokens.hashRefreshToken(refreshToken);
      const found = await db
        .select()
        .from(refreshTokens)
        .where(eq(refreshTokens.tokenHash, tokenHash))
        .limit(1);
      const row = found[0];
      if (row === undefined || row.revokedAt !== null) {
        throw new AppError(401, 'AUTH_INVALID', 'invalid refresh token');
      }
      if (row.expiresAt.getTime() <= Date.now()) {
        throw new AppError(401, 'TOKEN_EXPIRED', 'refresh token expired');
      }
      await db
        .update(refreshTokens)
        .set({ revokedAt: new Date() })
        .where(eq(refreshTokens.id, row.id));

      const foundUser = await db.select().from(users).where(eq(users.id, row.userId)).limit(1);
      const user = foundUser[0];
      if (user === undefined || user.deletedAt !== null) {
        throw new AppError(401, 'AUTH_INVALID', 'user not found');
      }
      const issued = await issue(user.id, userAgent);
      return { user: toProfile(user), ...issued };
    },

    async logout(refreshToken) {
      const tokenHash = tokens.hashRefreshToken(refreshToken);
      await db
        .update(refreshTokens)
        .set({ revokedAt: new Date() })
        .where(and(eq(refreshTokens.tokenHash, tokenHash), isNull(refreshTokens.revokedAt)));
    },

    async getProfile(userId) {
      const found = await db.select().from(users).where(eq(users.id, userId)).limit(1);
      const user = found[0];
      if (user === undefined || user.deletedAt !== null) {
        throw new AppError(401, 'AUTH_REQUIRED', 'user not found');
      }
      return toProfile(user);
    },

    async updateProfile(userId, displayName) {
      const updated = await db
        .update(users)
        .set({ displayName, updatedAt: new Date() })
        .where(eq(users.id, userId))
        .returning();
      const user = updated[0];
      if (user === undefined) {
        throw new AppError(401, 'AUTH_REQUIRED', 'user not found');
      }
      return toProfile(user);
    },

    async deleteAccount(userId) {
      await db
        .update(users)
        .set({ deletedAt: new Date(), updatedAt: new Date() })
        .where(eq(users.id, userId));
      await db
        .update(refreshTokens)
        .set({ revokedAt: new Date() })
        .where(eq(refreshTokens.userId, userId));
    },
  };
}
