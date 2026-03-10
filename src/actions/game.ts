"use server";

import { db } from "@/db";
import { gameSessions, words, categories, guesses } from "@/db/schema";
import { eq, inArray } from "drizzle-orm";
import { computeScore, DIFFICULTY_POINTS } from "@/lib/math";

// ---------------------------------------------------------------------------
// Shared type for a group revealed after the game ends
// ---------------------------------------------------------------------------

export type RevealedGroup = {
  categoryId: string;
  categoryTitle: string;
  colorTheme: string;
  wordIds: string[];
  difficulty: number;
};

// ---------------------------------------------------------------------------
// Return type — discriminated union keeps the client type-safe
// ---------------------------------------------------------------------------

export type GuessResult =
  // Correct guess, game continues
  | {
      correct: true;
      gameOver: false;
      categoryId: string;
      categoryTitle: string;
      colorTheme: string;
      wordIds: string[];
      difficulty: number;
    }
  // Correct guess, all groups solved → WON
  | {
      correct: true;
      gameOver: true;
      status: "WON";
      score: number;
      categoryId: string;
      categoryTitle: string;
      colorTheme: string;
      wordIds: string[];
      difficulty: number;
    }
  // Wrong guess, game continues — no reveal
  | {
      correct: false;
      gameOver: false;
      mistakes: number;
      oneAway: boolean;
    }
  // Wrong guess, 4 mistakes → LOST; remaining groups exposed in revealedAll
  | {
      correct: false;
      gameOver: true;
      status: "LOST";
      score: number;
      mistakes: number;
      revealedAll: RevealedGroup[];
    };

// ---------------------------------------------------------------------------
// submitGuess
//
// Security properties:
//   - Guess row is written to DB BEFORE the response is returned.
//     A page refresh cannot erase the mistake.
//   - Category metadata is returned ONLY after a group is correctly solved or
//     revealed via a wrong guess.
//   - start_time / end_time are fully server-authoritative.
// ---------------------------------------------------------------------------

export async function submitGuess(
  sessionId: string,
  wordIds: string[]
): Promise<GuessResult> {
  if (wordIds.length !== 4) throw new Error("Exactly 4 word IDs required.");

  // Fetch session + words in parallel to cut a round-trip
  const [sessionRows, wordRows] = await Promise.all([
    db.select().from(gameSessions).where(eq(gameSessions.id, sessionId)).limit(1),
    db.select({ id: words.id, categoryId: words.category_id }).from(words).where(inArray(words.id, wordIds)),
  ]);

  const session = sessionRows[0];
  if (!session) throw new Error("Session not found.");
  if (session.status !== "IN_PROGRESS") throw new Error("Session is no longer active.");
  if (wordRows.length !== 4) throw new Error("One or more word IDs are invalid.");

  // 3. Check if all 4 belong to the same category
  const uniqueCategories = Array.from(new Set(wordRows.map((w) => w.categoryId)));
  const isCorrect = uniqueCategories.length === 1;
  const categoryCounts = wordRows.reduce((acc, row) => {
    acc.set(row.categoryId, (acc.get(row.categoryId) ?? 0) + 1);
    return acc;
  }, new Map<string, number>());
  const oneAway = !isCorrect && Array.from(categoryCounts.values()).some((count) => count === 3);

  const currentSolved = JSON.parse(session.solved_groups) as string[];
  const currentRevealed = JSON.parse(session.revealed_groups) as string[];

  // -------------------------------------------------------------------------
  // 5. Branch: correct guess
  // -------------------------------------------------------------------------

  if (isCorrect) {
    const categoryId = uniqueCategories[0];
    const newSolved = [...currentSolved, categoryId];

    // Persist guess + fetch category in parallel
    const [, catRows] = await Promise.all([
      db.insert(guesses).values({ session_id: sessionId, word_ids: JSON.stringify(wordIds), is_correct: true }),
      db.select().from(categories).where(eq(categories.id, categoryId)).limit(1),
    ]);
    const cat = catRows[0];

    // Win condition: all 4 groups are either solved or already revealed
    const isWon = newSolved.length === 4 || newSolved.length + currentRevealed.length === 4;

    if (isWon) {
      const endTime = new Date();

      // Difficulty points only for correctly solved groups (revealed groups earn 0)
      const solvedCats = await db
        .select({ difficulty: categories.difficulty })
        .from(categories)
        .where(inArray(categories.id, newSolved));

      const difficultyPoints = solvedCats.reduce(
        (sum, c) => sum + (DIFFICULTY_POINTS[c.difficulty] ?? 0),
        0
      );

      const score = computeScore("WON", session.start_time, endTime, session.mistakes, difficultyPoints);

      await db
        .update(gameSessions)
        .set({ solved_groups: JSON.stringify(newSolved), status: "WON", end_time: endTime, score })
        .where(eq(gameSessions.id, sessionId));

      return {
        correct: true,
        gameOver: true,
        status: "WON",
        score,
        categoryId: cat.id,
        categoryTitle: cat.title,
        colorTheme: cat.color_theme,
        wordIds,
        difficulty: cat.difficulty,
      };
    }

    await db
      .update(gameSessions)
      .set({ solved_groups: JSON.stringify(newSolved) })
      .where(eq(gameSessions.id, sessionId));

    return {
      correct: true,
      gameOver: false,
      categoryId: cat.id,
      categoryTitle: cat.title,
      colorTheme: cat.color_theme,
      wordIds,
      difficulty: cat.difficulty,
    };
  }

  // -------------------------------------------------------------------------
  // 6. Branch: wrong guess
  // -------------------------------------------------------------------------

  const newMistakes = session.mistakes + 1;

  if (newMistakes >= 4) {
    const endTime = new Date();

    // Persist guess + fetch all categories in parallel
    const [, allCats] = await Promise.all([
      db.insert(guesses).values({ session_id: sessionId, word_ids: JSON.stringify(wordIds), is_correct: false }),
      db.select().from(categories).where(eq(categories.puzzle_id, session.puzzle_id)),
    ]);

    const alreadyDone = new Set([...currentSolved, ...currentRevealed]);
    const remainingCats = allCats.filter((c) => !alreadyDone.has(c.id));

    let revealedAll: RevealedGroup[] = [];
    if (remainingCats.length > 0) {
      const remainingCatIds = remainingCats.map((c) => c.id);
      const remainingWords = await db
        .select({ id: words.id, categoryId: words.category_id })
        .from(words)
        .where(inArray(words.category_id, remainingCatIds));

      const wordsByCat = new Map<string, string[]>();
      for (const w of remainingWords) {
        if (!wordsByCat.has(w.categoryId)) wordsByCat.set(w.categoryId, []);
        wordsByCat.get(w.categoryId)!.push(w.id);
      }

      revealedAll = remainingCats.map((c) => ({
        categoryId: c.id,
        categoryTitle: c.title,
        colorTheme: c.color_theme,
        wordIds: wordsByCat.get(c.id) ?? [],
        difficulty: c.difficulty,
      }));
    }

    // Score from correctly solved groups only (revealed groups earn 0)
    let score = 0;
    if (currentSolved.length > 0) {
      const solvedCats = await db
        .select({ difficulty: categories.difficulty })
        .from(categories)
        .where(inArray(categories.id, currentSolved));
      const difficultyPoints = solvedCats.reduce(
        (sum, c) => sum + (DIFFICULTY_POINTS[c.difficulty] ?? 0),
        0
      );
      score = computeScore("WON", session.start_time, endTime, newMistakes, difficultyPoints);
    }

    const newRevealedIds = [...currentRevealed, ...revealedAll.map((g) => g.categoryId)];
    await db
      .update(gameSessions)
      .set({ mistakes: newMistakes, revealed_groups: JSON.stringify(newRevealedIds), status: "LOST", end_time: endTime, score })
      .where(eq(gameSessions.id, sessionId));

    return { correct: false, gameOver: true, status: "LOST", score, mistakes: newMistakes, revealedAll };
  }

  // Wrong guess, game continues — persist guess + update mistakes in parallel
  await Promise.all([
    db.insert(guesses).values({ session_id: sessionId, word_ids: JSON.stringify(wordIds), is_correct: false }),
    db.update(gameSessions).set({ mistakes: newMistakes }).where(eq(gameSessions.id, sessionId)),
  ]);

  return { correct: false, gameOver: false, mistakes: newMistakes, oneAway };
}
