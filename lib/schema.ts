import {
  bigserial,
  check,
  inet,
  integer,
  pgTable,
  primaryKey,
  smallint,
  text,
  timestamp,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

export const shuffles = pgTable(
  'shuffles',
  {
    id: bigserial('id', { mode: 'number' }).primaryKey(),
    hash: text('hash').notNull().unique(),
    sequence: smallint('sequence').array().notNull(),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    sequenceLength: check(
      'sequence_length_52',
      sql`array_length(${table.sequence}, 1) = 52`,
    ),
  }),
);

export const rateLimits = pgTable(
  'rate_limits',
  {
    ip: inet('ip').notNull(),
    windowStart: timestamp('window_start', { withTimezone: true }).notNull(),
    count: integer('count').notNull(),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.ip, table.windowStart] }),
  }),
);

export type Shuffle = typeof shuffles.$inferSelect;
export type NewShuffle = typeof shuffles.$inferInsert;
