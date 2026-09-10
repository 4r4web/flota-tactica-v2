import {
  bigserial,
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';

export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  email: text('email').notNull().unique(),
  passwordHash: text('password_hash'),
  displayName: text('display_name').notNull(),
  emailVerified: boolean('email_verified').notNull().default(false),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
});

export const oauthAccounts = pgTable(
  'oauth_accounts',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    provider: text('provider').notNull(),
    providerUserId: text('provider_user_id').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('oauth_accounts_provider_user_unique').on(table.provider, table.providerUserId),
    index('oauth_accounts_user_idx').on(table.userId),
  ],
);

export const refreshTokens = pgTable(
  'refresh_tokens',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    tokenHash: text('token_hash').notNull().unique(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    revokedAt: timestamp('revoked_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    userAgent: text('user_agent'),
  },
  (table) => [index('refresh_tokens_user_idx').on(table.userId)],
);

export const games = pgTable(
  'games',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    status: text('status').notNull(),
    mode: text('mode').notNull(),
    winnerUserId: uuid('winner_user_id').references(() => users.id),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    finishedAt: timestamp('finished_at', { withTimezone: true }),
    finalEpoch: integer('final_epoch').notNull().default(0),
  },
  (table) => [index('games_status_idx').on(table.status)],
);

export const gamePlayers = pgTable(
  'game_players',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    gameId: uuid('game_id')
      .notNull()
      .references(() => games.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id),
    role: text('role').notNull(),
    result: text('result'),
    fleetSnapshot: jsonb('fleet_snapshot'),
  },
  (table) => [
    uniqueIndex('game_players_game_role_unique').on(table.gameId, table.role),
    index('game_players_user_idx').on(table.userId),
  ],
);

export const gameEvents = pgTable(
  'game_events',
  {
    id: bigserial('id', { mode: 'number' }).primaryKey(),
    gameId: uuid('game_id')
      .notNull()
      .references(() => games.id, { onDelete: 'cascade' }),
    epoch: integer('epoch').notNull(),
    seq: integer('seq').notNull(),
    turn: integer('turn').notNull(),
    actorUserId: uuid('actor_user_id').references(() => users.id),
    type: text('type').notNull(),
    payload: jsonb('payload').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index('game_events_game_seq_idx').on(table.gameId, table.epoch, table.seq)],
);
