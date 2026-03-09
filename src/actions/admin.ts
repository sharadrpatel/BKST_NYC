"use server";

import { redirect } from "next/navigation";
import { eq, not, desc } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { puzzles, categories, words, players, gameSessions } from "@/db/schema";
import { assertAdmin, clearAdminCookie, setAdminCookie } from "@/lib/admin-session";
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

  revalidatePath("/admin");

  return { puzzleId };
}

// ---------------------------------------------------------------------------
// updatePuzzle
//
// Updates title, category names, and word text for an existing puzzle.
// All IDs must already exist — this never creates or deletes rows.
// ---------------------------------------------------------------------------

export interface UpdatePuzzleInput {
  puzzleId: string;
  title: string;
  categories: Array<{
    id: string;
    title: string;
    words: Array<{ id: string; text: string }>;
  }>;
}

export async function updatePuzzle(data: UpdatePuzzleInput): Promise<void> {
  await assertAdmin();

  if (!data.title.trim()) throw new Error("Puzzle title is required.");
  if (data.categories.length !== 4) throw new Error("Exactly 4 categories required.");
  for (const cat of data.categories) {
    if (!cat.title.trim()) throw new Error("All category titles are required.");
    if (cat.words.length !== 4 || cat.words.some((w) => !w.text.trim()))
      throw new Error("Each category needs exactly 4 non-empty words.");
  }

  await db.transaction(async (tx) => {
    await tx
      .update(puzzles)
      .set({ title: data.title.trim() })
      .where(eq(puzzles.id, data.puzzleId));

    for (const cat of data.categories) {
      await tx
        .update(categories)
        .set({ title: cat.title.trim() })
        .where(eq(categories.id, cat.id));

      for (const word of cat.words) {
        await tx
          .update(words)
          .set({ text: word.text.trim().toUpperCase() })
          .where(eq(words.id, word.id));
      }
    }
  });

  revalidatePath("/");
  revalidatePath("/play");
  revalidatePath("/admin");
  revalidatePath("/leaderboard");
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

  revalidatePath("/");
  revalidatePath("/play");
  revalidatePath("/admin");
  revalidatePath("/leaderboard");
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
// createPlayer
//
// Creates a single player with a specific BKID and display name.
// Throws if the BKID already exists.
// ---------------------------------------------------------------------------

export async function createPlayer(data: {
  displayName: string;
  accessCode: string;
  mode: "scored" | "test";
}): Promise<void> {
  await assertAdmin();

  const code = data.accessCode.trim().toUpperCase();
  if (!code) throw new Error("BKID is required.");
  if (!data.displayName.trim()) throw new Error("Display name is required.");
  if (data.mode !== "scored" && data.mode !== "test")
    throw new Error("Mode must be scored or test.");

  try {
    await db.insert(players).values({
      access_code: code,
      display_name: data.displayName.trim(),
      mode: data.mode,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes("unique") || msg.includes("duplicate") || msg.includes("23505")) {
      throw new Error(`BKID "${code}" already exists.`);
    }
    throw err;
  }

  revalidatePath("/admin");
}

// ---------------------------------------------------------------------------
// deletePuzzle
//
// Deletes a puzzle (cascades to categories and words).
// Blocked if any game sessions reference the puzzle (to preserve score history).
// If the target is the active puzzle and another puzzle exists, that one is
// auto-activated before deletion. If no other puzzle exists, the site will
// have no active puzzle until one is set.
// ---------------------------------------------------------------------------

export async function deletePuzzle(puzzleId: string): Promise<void> {
  await assertAdmin();

  const [puzzle] = await db
    .select()
    .from(puzzles)
    .where(eq(puzzles.id, puzzleId))
    .limit(1);

  if (!puzzle) throw new Error("Puzzle not found.");

  // Block deletion if any sessions reference this puzzle (score history would be lost).
  const sessionCount = await db.$count(
    gameSessions,
    eq(gameSessions.puzzle_id, puzzleId)
  );
  if (sessionCount > 0) {
    throw new Error(
      `Cannot delete: ${sessionCount} game session(s) reference this puzzle. Data would be lost.`
    );
  }

  if (puzzle.is_active) {
    // Auto-activate the most recently created other puzzle before deleting.
    const [other] = await db
      .select({ id: puzzles.id })
      .from(puzzles)
      .where(not(eq(puzzles.id, puzzleId)))
      .orderBy(desc(puzzles.created_at))
      .limit(1);

    await db.transaction(async (tx) => {
      if (other) {
        await tx
          .update(puzzles)
          .set({ is_active: true })
          .where(eq(puzzles.id, other.id));
      }
      await tx.delete(puzzles).where(eq(puzzles.id, puzzleId));
    });
  } else {
    await db.delete(puzzles).where(eq(puzzles.id, puzzleId));
  }

  revalidatePath("/");
  revalidatePath("/play");
  revalidatePath("/admin");
  revalidatePath("/leaderboard");
}

// ---------------------------------------------------------------------------
// adminLogin
// ---------------------------------------------------------------------------

export async function adminLogin(formData: FormData): Promise<never> {
  const password = (formData.get("password") as string | null)?.trim() ?? "";

  if (
    !password ||
    !process.env.ADMIN_KEY ||
    password !== process.env.ADMIN_KEY
  ) {
    redirect("/admin/login?error=1");
  }

  await setAdminCookie();
  redirect("/admin");
}

// ---------------------------------------------------------------------------
// adminLogout
// ---------------------------------------------------------------------------

export async function adminLogout(): Promise<never> {
  await clearAdminCookie();
  redirect("/admin/login");
}
