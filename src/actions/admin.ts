"use server";

import { redirect } from "next/navigation";
import { eq, not, desc } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { puzzles, categories, words, players, gameSessions } from "@/db/schema";
import { assertAdmin, clearAdminCookie, setAdminCookie } from "@/lib/admin-session";
import { generateAccessCode } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Shared result types
// ---------------------------------------------------------------------------

export interface ActionResult {
  error?: string;
}

export interface ImportResult {
  inserted: number;
  skipped: number;
  errors: string[];
}

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
// Force-deletes a puzzle and ALL dependent data:
//   guesses (cascade from sessions) → game_sessions → puzzle (cascade to categories/words)
// If the target is the active puzzle and another puzzle exists, that one is
// auto-activated. If no other puzzle exists, the site will have no active puzzle.
// Returns { error } on failure instead of throwing, so the UI can display it inline.
// ---------------------------------------------------------------------------

export async function deletePuzzle(puzzleId: string): Promise<ActionResult> {
  await assertAdmin();

  try {
    const [puzzle] = await db
      .select()
      .from(puzzles)
      .where(eq(puzzles.id, puzzleId))
      .limit(1);

    if (!puzzle) return { error: "Puzzle not found." };

    await db.transaction(async (tx) => {
      // 1. Delete all game sessions for this puzzle.
      //    Guesses cascade-delete automatically (FK onDelete: "cascade").
      await tx.delete(gameSessions).where(eq(gameSessions.puzzle_id, puzzleId));

      // 2. If this was the active puzzle, promote the next most recent one.
      if (puzzle.is_active) {
        const [other] = await tx
          .select({ id: puzzles.id })
          .from(puzzles)
          .where(not(eq(puzzles.id, puzzleId)))
          .orderBy(desc(puzzles.created_at))
          .limit(1);

        if (other) {
          await tx
            .update(puzzles)
            .set({ is_active: true })
            .where(eq(puzzles.id, other.id));
        }
        // If no other puzzle exists, the site will have no active puzzle — caller warned via UI.
      }

      // 3. Delete the puzzle. Categories and words cascade-delete automatically.
      await tx.delete(puzzles).where(eq(puzzles.id, puzzleId));
    });

    revalidatePath("/");
    revalidatePath("/play");
    revalidatePath("/admin");
    revalidatePath("/leaderboard");
    return {};
  } catch (err) {
    return { error: err instanceof Error ? err.message : String(err) };
  }
}

// ---------------------------------------------------------------------------
// deletePlayerResult
//
// Removes a single game session (and its guesses) without touching the player.
// This removes the player's leaderboard entry for that puzzle.
// ---------------------------------------------------------------------------

export async function deletePlayerResult(sessionId: string): Promise<ActionResult> {
  await assertAdmin();

  try {
    const [session] = await db
      .select({ id: gameSessions.id })
      .from(gameSessions)
      .where(eq(gameSessions.id, sessionId))
      .limit(1);

    if (!session) return { error: "Session not found." };

    // Guesses cascade-delete automatically via FK onDelete: "cascade".
    await db.delete(gameSessions).where(eq(gameSessions.id, sessionId));

    revalidatePath("/admin");
    revalidatePath("/leaderboard");
    return {};
  } catch (err) {
    return { error: err instanceof Error ? err.message : String(err) };
  }
}

// ---------------------------------------------------------------------------
// resetActivePuzzleLeaderboard
//
// Deletes all game sessions (and their guesses) for the currently active puzzle.
// The puzzle, categories, and words are untouched.
// Returns { count } on success, { error } on failure.
// ---------------------------------------------------------------------------

export async function resetActivePuzzleLeaderboard(): Promise<
  ActionResult & { count?: number }
> {
  await assertAdmin();

  try {
    const [active] = await db
      .select({ id: puzzles.id, title: puzzles.title })
      .from(puzzles)
      .where(eq(puzzles.is_active, true))
      .limit(1);

    if (!active) return { error: "No active puzzle found." };

    // Count first so we can report how many were deleted.
    const count = await db.$count(gameSessions, eq(gameSessions.puzzle_id, active.id));

    // Guesses cascade-delete automatically via FK onDelete: "cascade".
    await db.delete(gameSessions).where(eq(gameSessions.puzzle_id, active.id));

    revalidatePath("/admin");
    revalidatePath("/leaderboard");
    return { count };
  } catch (err) {
    return { error: err instanceof Error ? err.message : String(err) };
  }
}

// ---------------------------------------------------------------------------
// importPlayers
//
// Bulk-creates players from CSV text. Each line: BKID,Display Name,Mode
// Mode must be "scored" or "test" (case-insensitive); defaults to "scored" if omitted.
// Skips duplicate BKIDs silently. Returns inserted/skipped counts and per-row errors.
// ---------------------------------------------------------------------------

export async function importPlayers(csv: string): Promise<ImportResult> {
  await assertAdmin();

  const lines = csv
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.length > 0 && !l.startsWith("#"));

  if (lines.length === 0) {
    return { inserted: 0, skipped: 0, errors: ["No valid lines found."] };
  }

  const errors: string[] = [];
  const valid: { access_code: string; display_name: string; mode: "scored" | "test" }[] = [];
  const seen = new Set<string>();

  for (let i = 0; i < lines.length; i++) {
    const lineNum = i + 1;
    const parts = lines[i].split(",").map((p) => p.trim());

    const rawCode = parts[0];
    const rawName = parts[1];
    const rawMode = (parts[2] ?? "scored").toLowerCase();

    if (!rawCode) {
      errors.push(`Line ${lineNum}: missing BKID.`);
      continue;
    }
    if (!rawName) {
      errors.push(`Line ${lineNum}: missing Display Name.`);
      continue;
    }
    if (rawMode !== "scored" && rawMode !== "test") {
      errors.push(`Line ${lineNum}: mode must be "scored" or "test", got "${parts[2]}".`);
      continue;
    }

    const code = rawCode.toUpperCase();

    if (seen.has(code)) {
      errors.push(`Line ${lineNum}: duplicate BKID "${code}" within this import.`);
      continue;
    }
    seen.add(code);

    valid.push({ access_code: code, display_name: rawName, mode: rawMode });
  }

  if (valid.length === 0) {
    return { inserted: 0, skipped: 0, errors };
  }

  const inserted = await db
    .insert(players)
    .values(valid)
    .onConflictDoNothing()
    .returning({ access_code: players.access_code });

  const insertedCount = inserted.length;
  const skipped = valid.length - insertedCount;

  revalidatePath("/admin");
  return { inserted: insertedCount, skipped, errors };
}

// ---------------------------------------------------------------------------
// updatePlayer
//
// Updates display_name, access_code, and mode for an existing player.
// Returns { error } on failure (e.g. duplicate BKID) so the UI can show it.
// ---------------------------------------------------------------------------

export async function updatePlayer(
  id: string,
  data: { displayName: string; accessCode: string; mode: "scored" | "test" }
): Promise<ActionResult> {
  await assertAdmin();

  const code = data.accessCode.trim().toUpperCase();
  if (!code) return { error: "BKID is required." };
  if (!data.displayName.trim()) return { error: "Display name is required." };
  if (data.mode !== "scored" && data.mode !== "test") return { error: "Invalid mode." };

  try {
    const [existing] = await db
      .select({ id: players.id })
      .from(players)
      .where(eq(players.id, id))
      .limit(1);

    if (!existing) return { error: "Player not found." };

    await db
      .update(players)
      .set({ display_name: data.displayName.trim(), access_code: code, mode: data.mode })
      .where(eq(players.id, id));

    revalidatePath("/admin");
    revalidatePath("/leaderboard");
    return {};
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes("unique") || msg.includes("duplicate") || msg.includes("23505")) {
      return { error: `BKID "${code}" is already in use by another player.` };
    }
    return { error: msg };
  }
}

// ---------------------------------------------------------------------------
// deletePlayer
//
// Cascade-deletes all game sessions (and their guesses) for the player,
// then deletes the player record itself. This is irreversible — the UI must
// show a confirmation with the session count before calling this.
// ---------------------------------------------------------------------------

export async function deletePlayer(id: string): Promise<ActionResult> {
  await assertAdmin();

  try {
    const [player] = await db
      .select({ id: players.id })
      .from(players)
      .where(eq(players.id, id))
      .limit(1);

    if (!player) return { error: "Player not found." };

    await db.transaction(async (tx) => {
      // Delete all sessions for this player (guesses cascade via FK).
      await tx.delete(gameSessions).where(eq(gameSessions.player_id, id));
      // Delete the player.
      await tx.delete(players).where(eq(players.id, id));
    });

    revalidatePath("/");
    revalidatePath("/admin");
    revalidatePath("/leaderboard");
    return {};
  } catch (err) {
    return { error: err instanceof Error ? err.message : String(err) };
  }
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
