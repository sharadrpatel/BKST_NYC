/**
 * Seed script — Phase 1 test data
 * Run: npm run seed
 *
 * Inserts:
 *   - 1 active puzzle
 *   - 4 categories (difficulty 1–4)
 *   - 16 words (4 per category)
 *   - 10 test players with unique access codes
 */

import { drizzle } from "drizzle-orm/vercel-postgres";
import { sql } from "@vercel/postgres";
import * as schema from "../src/db/schema";

const db = drizzle(sql, { schema });

const PUZZLE_TITLE = "BKST Retreat 2024";

const CATEGORIES = [
  {
    title: "Things You Grill",
    difficulty: 1,
    color_theme: "#F9DF6D",
    words: ["BURGER", "CORN", "STEAK", "KEBAB"],
  },
  {
    title: "NYC Neighborhoods",
    difficulty: 2,
    color_theme: "#A0C35A",
    words: ["TRIBECA", "DUMBO", "HARLEM", "SOHO"],
  },
  {
    title: "Things in a Gym Bag",
    difficulty: 3,
    color_theme: "#B0C4EF",
    words: ["TOWEL", "LOCK", "SNEAKERS", "SHAKER"],
  },
  {
    title: "___ York",
    difficulty: 4,
    color_theme: "#BA81C5",
    words: ["NEW", "OLD", "DEAR", "YOUNG"],
  },
];

const PLAYERS = [
  { display_name: "Alice",   access_code: "ALPHA-101" },
  { display_name: "Bob",     access_code: "BRAVO-202" },
  { display_name: "Carol",   access_code: "CHARLIE-303" },
  { display_name: "Dave",    access_code: "DELTA-404" },
  { display_name: "Eve",     access_code: "ECHO-505" },
  { display_name: "Frank",   access_code: "FOXTROT-606" },
  { display_name: "Grace",   access_code: "GOLF-707" },
  { display_name: "Hank",    access_code: "HOTEL-808" },
  { display_name: "Iris",    access_code: "INDIA-909" },
  { display_name: "Jack",    access_code: "JULIET-010" },
];

async function seed() {
  console.log("🌱  Seeding database…");

  // Deactivate any existing active puzzles
  await db
    .update(schema.puzzles)
    .set({ is_active: false });

  // Insert puzzle
  const [puzzle] = await db
    .insert(schema.puzzles)
    .values({ title: PUZZLE_TITLE, is_active: true })
    .returning();
  console.log(`  ✓ Puzzle created: ${puzzle.id}`);

  // Insert categories + words
  for (const cat of CATEGORIES) {
    const [category] = await db
      .insert(schema.categories)
      .values({
        puzzle_id: puzzle.id,
        title: cat.title,
        difficulty: cat.difficulty,
        color_theme: cat.color_theme,
      })
      .returning();

    await db.insert(schema.words).values(
      cat.words.map((text) => ({ category_id: category.id, text }))
    );
    console.log(`  ✓ Category [D${cat.difficulty}] "${cat.title}" + ${cat.words.length} words`);
  }

  // Insert players (skip on conflict so seed is re-runnable)
  for (const p of PLAYERS) {
    await db
      .insert(schema.players)
      .values(p)
      .onConflictDoNothing();
  }
  console.log(`  ✓ ${PLAYERS.length} test players upserted`);

  console.log("\n✅  Seed complete.");
  process.exit(0);
}

seed().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
