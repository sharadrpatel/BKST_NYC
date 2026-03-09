"use server";

import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { puzzles, categories, words, players } from "@/db/schema";
import { assertAdmin, clearAdminCookie } from "@/lib/admin-session";
import { generateAccessCode } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Difficulty → default color mapping
// ---------------------------------------------------------------------------

const DIFFICULTY_COLORS: Record<number, string> = {
  1: "#F9DF6D",
  2: "#A0C35A",
  3: "#B0C4EF",
  4: "#BA81C5",
};

// ---------------------------------------------------------------------------
// createPuzzle
//
// Inserts one puzzle + 4 categories + 4 words each in a single transaction.
// The new puzzle is created inactive; use setActivePuzzle() to promote it.
// ---------------------------------------------------------------------------

export interface CreatePuzzleInput {
  title: string;
  categories: Array<{
    title: string;
    difficulty: number;
    words: [string, string, string, string];
  }>;
}

export async function createPuzzle(
  data: CreatePuzzleInput
): Promise<{ puzzleId: string }> {
  await assertAdmin();

  if (!data.title.trim()) throw new Error("Puzzle title is required.");
  if (data.categories.length !== 4) throw new Error("Exactly 4 categories required.");

  for (const cat of data.categories) {
    if (!cat.title.trim()) throw new Error("All category titles are required.");
    if (cat.difficulty < 1 || cat.difficulty > 4)
      throw new Error("Difficulty must be 1–4.");
    if (cat.words.length !== 4 || cat.words.some((w) => !w.trim()))
      throw new Error("Each category needs exactly 4 non-empty words.");
  }

  const puzzleId = await db.transaction(async (tx) => {
    const [puzzle] = await tx
      .insert(puzzles)
      .values({ title: data.title.trim(), is_active: false })
      .returning({ id: puzzles.id });

    for (const cat of data.categories) {
      const colorTheme = DIFFICULTY_COLORS[cat.difficulty] ?? "#888";

      const [category] = await tx
        .insert(categories)
        .values({
          puzzle_id: puzzle.id,
          title: cat.title.trim(),
          difficulty: cat.difficulty,
          color_theme: colorTheme,
        })
        .returning({ id: categories.id });

      await tx.insert(words).values(
        cat.words.map((text) => ({
          category_id: category.id,
          text: text.trim().toUpperCase(),
        }))
      );
    }

    return puzzle.id;
  });

  return { puzzleId };
}

// ---------------------------------------------------------------------------
// setActivePuzzle
//
// Deactivates all puzzles then activates the target — in a transaction so
// there is never a moment with zero or two active puzzles.
// ---------------------------------------------------------------------------

export async function setActivePuzzle(puzzleId: string): Promise<void> {
  await assertAdmin();

  await db.transaction(async (tx) => {
    await tx.update(puzzles).set({ is_active: false });
    await tx
      .update(puzzles)
      .set({ is_active: true })
      .where(eq(puzzles.id, puzzleId));
  });
}

// ---------------------------------------------------------------------------
// generatePlayers
//
// Creates `count` players with access codes like "PREFIX-391".
// display_name = access_code. Skips any collision silently.
// Returns only the codes that were actually inserted.
// ---------------------------------------------------------------------------

export async function generatePlayers(
  count: number,
  prefix: string
): Promise<{ codes: string[] }> {
  await assertAdmin();

  if (count < 1 || count > 200) throw new Error("Count must be between 1 and 200.");
  if (!prefix.trim()) throw new Error("Prefix is required.");

  // Generate slightly more than needed to absorb potential collisions
  const candidates = Array.from({ length: count + 10 }, () =>
    generateAccessCode(prefix)
  );

  // Deduplicate within this batch
  const unique = Array.from(new Set(candidates)).slice(0, count);

  const inserted = await db
    .insert(players)
    .values(
      unique.map((code) => ({
        access_code: code,
        display_name: code,
      }))
    )
    .onConflictDoNothing()
    .returning({ access_code: players.access_code });

  return { codes: inserted.map((r) => r.access_code) };
}

// ---------------------------------------------------------------------------
// adminLogout
// ---------------------------------------------------------------------------

export async function adminLogout(): Promise<never> {
  await clearAdminCookie();
  redirect("/admin/login");
}
