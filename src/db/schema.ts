import {
  pgTable,
  uuid,
  text,
  boolean,
  integer,
  timestamp,
  pgEnum,
  unique,
} from "drizzle-orm/pg-core";

// ---------------------------------------------------------------------------
// Enums
// ---------------------------------------------------------------------------

export const sessionStatusEnum = pgEnum("session_status", [
  "IN_PROGRESS",
  "WON",
  "LOST",
]);

// ---------------------------------------------------------------------------
// Puzzle — one active puzzle at a time (enforced via is_active)
// ---------------------------------------------------------------------------

export const puzzles = pgTable("puzzles", {
  id: uuid("id").primaryKey().defaultRandom(),
  title: text("title").notNull(),
  is_active: boolean("is_active").notNull().default(false),
  created_at: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

// ---------------------------------------------------------------------------
// Category — 4 per puzzle, difficulty 1 (easiest/yellow) → 4 (hardest/purple)
// ---------------------------------------------------------------------------

export const categories = pgTable("categories", {
  id: uuid("id").primaryKey().defaultRandom(),
  puzzle_id: uuid("puzzle_id")
    .notNull()
    .references(() => puzzles.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  difficulty: integer("difficulty").notNull(), // 1–4
  color_theme: text("color_theme").notNull(),  // e.g. "#F9DF6D" or "yellow"
});

// ---------------------------------------------------------------------------
// Word — 4 per category
// ---------------------------------------------------------------------------

export const words = pgTable("words", {
  id: uuid("id").primaryKey().defaultRandom(),
  category_id: uuid("category_id")
    .notNull()
    .references(() => categories.id, { onDelete: "cascade" }),
  text: text("text").notNull(),
});

// ---------------------------------------------------------------------------
// Player — pre-assigned by admin, unique access code
// ---------------------------------------------------------------------------

export const players = pgTable("players", {
  id: uuid("id").primaryKey().defaultRandom(),
  access_code: text("access_code").notNull().unique(),
  display_name: text("display_name").notNull(),
});

// ---------------------------------------------------------------------------
// GameSession — one per player, enforced at DB level
// solved_groups stores category IDs the player has correctly solved (JSON array)
// ---------------------------------------------------------------------------

export const gameSessions = pgTable(
  "game_sessions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    player_id: uuid("player_id")
      .notNull()
      .references(() => players.id),
    puzzle_id: uuid("puzzle_id")
      .notNull()
      .references(() => puzzles.id),
    status: sessionStatusEnum("status").notNull().default("IN_PROGRESS"),
    mistakes: integer("mistakes").notNull().default(0),
    // JSON array of solved category IDs, e.g. ["uuid1", "uuid2"]
    solved_groups: text("solved_groups").notNull().default("[]"),
    start_time: timestamp("start_time", { withTimezone: true })
      .notNull()
      .defaultNow(),
    end_time: timestamp("end_time", { withTimezone: true }),
    score: integer("score"),
  },
  (t) => [
    // One session per player — DB-level enforcement
    unique("uq_game_sessions_player_id").on(t.player_id),
  ]
);

// ---------------------------------------------------------------------------
// Guess — every submission recorded (correct and incorrect)
// word_ids is a JSON array of the 4 Word UUIDs submitted
// ---------------------------------------------------------------------------

export const guesses = pgTable("guesses", {
  id: uuid("id").primaryKey().defaultRandom(),
  session_id: uuid("session_id")
    .notNull()
    .references(() => gameSessions.id, { onDelete: "cascade" }),
  word_ids: text("word_ids").notNull(), // JSON array: ["uuid","uuid","uuid","uuid"]
  is_correct: boolean("is_correct").notNull(),
  created_at: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});
