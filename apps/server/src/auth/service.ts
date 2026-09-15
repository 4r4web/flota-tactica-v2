import { and, eq, isNull } from 'drizzle-orm';

import type { Config } from '../config.js';
import { passwordResetTokens, refreshTokens, users } from '../db/schema.js';
import { AppError } from '../errors.js';
import type { Database } from '../infra/db.js';
import type { Mailer } from './mailer.js';
import { hashPassword, verifyPassword } from './password.js';
import type { TokenService } from './tokens.js';

export interface UserProfile {
  id: string;
  email: string;
  displayName: string;
  createdAt: string;
  isAdmin: boolean;
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
  forgotPassword(email: string, baseUrl: string): Promise<void>;
  resetPassword(token: string, newPassword: string): Promise<void>;
  changePassword(userId: string, currentPassword: string, newPassword: string): Promise<void>;
}

type UserRow = typeof users.$inferSelect;

function toProfile(user: UserRow, adminEmail: string): UserProfile {
  return {
    id: user.id,
    email: user.email,
    displayName: user.displayName,
    createdAt: user.createdAt.toISOString(),
    isAdmin: user.email.toLowerCase() === adminEmail.toLowerCase(),
  };
}

export function createAuthService(
  db: Database,
  tokens: TokenService,
  mailer: Mailer,
  config: Config,
): AuthService {
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
      return { user: toProfile(user, config.adminEmail), ...issued };
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
      return { user: toProfile(user, config.adminEmail), ...issued };
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
      return { user: toProfile(user, config.adminEmail), ...issued };
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
      return toProfile(user, config.adminEmail);
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
      return toProfile(user, config.adminEmail);
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

    async forgotPassword(email, baseUrl) {
      const normalized = email.toLowerCase();
      const found = await db.select().from(users).where(eq(users.email, normalized)).limit(1);
      const user = found[0];
      // Never reveal whether the email exists.
      if (user === undefined || user.deletedAt !== null || user.passwordHash === null) {
        return;
      }
      const token = tokens.createRefreshToken();
      await db.insert(passwordResetTokens).values({
        userId: user.id,
        tokenHash: tokens.hashRefreshToken(token),
        expiresAt: new Date(Date.now() + config.passwordResetTtl * 1000),
      });
      const resetUrl = `${baseUrl}/reset?token=${encodeURIComponent(token)}`;
      await mailer.sendPasswordReset(user.email, resetUrl);
    },

    async resetPassword(token, newPassword) {
      const tokenHash = tokens.hashRefreshToken(token);
      const found = await db
        .select()
        .from(passwordResetTokens)
        .where(eq(passwordResetTokens.tokenHash, tokenHash))
        .limit(1);
      const row = found[0];
      if (row === undefined || row.usedAt !== null) {
        throw new AppError(400, 'INVALID_ACTION', 'invalid or already used reset token');
      }
      if (row.expiresAt.getTime() <= Date.now()) {
        throw new AppError(400, 'INVALID_ACTION', 'reset token expired');
      }
      const passwordHash = await hashPassword(newPassword);
      await db
        .update(users)
        .set({ passwordHash, updatedAt: new Date() })
        .where(eq(users.id, row.userId));
      await db
        .update(passwordResetTokens)
        .set({ usedAt: new Date() })
        .where(eq(passwordResetTokens.id, row.id));
      await db
        .update(refreshTokens)
        .set({ revokedAt: new Date() })
        .where(eq(refreshTokens.userId, row.userId));
    },

    async changePassword(userId, currentPassword, newPassword) {
      const found = await db.select().from(users).where(eq(users.id, userId)).limit(1);
      const user = found[0];
      if (user === undefined || user.passwordHash === null) {
        throw new AppError(400, 'INVALID_ACTION', 'this account has no password');
      }
      const valid = await verifyPassword(user.passwordHash, currentPassword);
      if (!valid) {
        throw new AppError(401, 'AUTH_INVALID', 'current password is incorrect');
      }
      const passwordHash = await hashPassword(newPassword);
      await db
        .update(users)
        .set({ passwordHash, updatedAt: new Date() })
        .where(eq(users.id, userId));
      await db
        .update(refreshTokens)
        .set({ revokedAt: new Date() })
        .where(eq(refreshTokens.userId, userId));
    },
  };
}
