"use server";

import { db } from "@/db";
import { gameSessions, words, categories, guesses } from "@/db/schema";
import { eq, inArray } from "drizzle-orm";
import { computeScore, DIFFICULTY_POINTS } from "@/lib/math";

// ---------------------------------------------------------------------------
// Shared type for a group revealed after a wrong guess
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
  // Correct guess, all groups accounted for → WON
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
  // Wrong guess, game continues — one category revealed
  | {
      correct: false;
      gameOver: false;
      mistakes: number;
      revealed: RevealedGroup | null;
    }
  // Wrong guess caused all groups to be accounted for → partial WON
  | {
      correct: false;
      gameOver: true;
      status: "WON";
      score: number;
      mistakes: number;
      revealed: RevealedGroup | null;
    }
  // Wrong guess, 4 mistakes → LOST; remaining groups exposed in revealedAll
  | {
      correct: false;
      gameOver: true;
      status: "LOST";
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

  // 1. Fetch and validate session
  const [session] = await db
    .select()
    .from(gameSessions)
    .where(eq(gameSessions.id, sessionId))
    .limit(1);

  if (!session) throw new Error("Session not found.");
  if (session.status !== "IN_PROGRESS") throw new Error("Session is no longer active.");

  // 2. Fetch the 4 words and their category assignments
  const wordRows = await db
    .select({ id: words.id, categoryId: words.category_id })
    .from(words)
    .where(inArray(words.id, wordIds));

  if (wordRows.length !== 4) throw new Error("One or more word IDs are invalid.");

  // 3. Check if all 4 belong to the same category
  const uniqueCategories = Array.from(new Set(wordRows.map((w) => w.categoryId)));
  const isCorrect = uniqueCategories.length === 1;

  // 4. Persist the guess BEFORE responding (prevents refresh-loop abuse)
  await db.insert(guesses).values({
    session_id: sessionId,
    word_ids: JSON.stringify(wordIds),
    is_correct: isCorrect,
  });

  const currentSolved = JSON.parse(session.solved_groups) as string[];
  const currentRevealed = JSON.parse(session.revealed_groups) as string[];

  // -------------------------------------------------------------------------
  // 5. Branch: correct guess
  // -------------------------------------------------------------------------

  if (isCorrect) {
    const categoryId = uniqueCategories[0];
    const newSolved = [...currentSolved, categoryId];

    // Fetch the category — safe to expose now that it's solved
    const [cat] = await db
      .select()
      .from(categories)
      .where(eq(categories.id, categoryId))
      .limit(1);

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
    // LOST — reveal every remaining unsolved + unrevealed category
    const endTime = new Date();

    const allCats = await db
      .select()
      .from(categories)
      .where(eq(categories.puzzle_id, session.puzzle_id));

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

    await db
      .update(gameSessions)
      .set({ mistakes: newMistakes, status: "LOST", end_time: endTime, score: 0 })
      .where(eq(gameSessions.id, sessionId));

    return { correct: false, gameOver: true, status: "LOST", mistakes: newMistakes, revealedAll };
  }

  // Wrong guess, game continues — find the best-matching category to reveal.
  // "Best match" = the category with the most submitted words (highest overlap).
  const overlapCount = new Map<string, number>();
  for (const w of wordRows) {
    overlapCount.set(w.categoryId, (overlapCount.get(w.categoryId) ?? 0) + 1);
  }
  const sortedByOverlap = [...overlapCount.entries()].sort((a, b) => b[1] - a[1]);

  const alreadyDone = new Set([...currentSolved, ...currentRevealed]);
  let revealedGroup: RevealedGroup | null = null;
  let newRevealedIds = currentRevealed;

  for (const [catId] of sortedByOverlap) {
    if (!alreadyDone.has(catId)) {
      const [cat] = await db
        .select()
        .from(categories)
        .where(eq(categories.id, catId))
        .limit(1);

      const catWords = await db
        .select({ id: words.id })
        .from(words)
        .where(eq(words.category_id, catId));

      revealedGroup = {
        categoryId: cat.id,
        categoryTitle: cat.title,
        colorTheme: cat.color_theme,
        wordIds: catWords.map((w) => w.id),
        difficulty: cat.difficulty,
      };

      newRevealedIds = [...currentRevealed, catId];
      break;
    }
  }

  // Edge case: this reveal fills the last slot (solved + revealed = 4)
  const allDone = currentSolved.length + newRevealedIds.length === 4;
  if (allDone) {
    const endTime = new Date();

    if (currentSolved.length === 0) {
      // Nothing solved — LOST
      await db
        .update(gameSessions)
        .set({ mistakes: newMistakes, revealed_groups: JSON.stringify(newRevealedIds), status: "LOST", end_time: endTime, score: 0 })
        .where(eq(gameSessions.id, sessionId));
      return { correct: false, gameOver: true, status: "LOST", mistakes: newMistakes, revealedAll: [] };
    }

    // At least one group solved — partial WON
    const solvedCats = await db
      .select({ difficulty: categories.difficulty })
      .from(categories)
      .where(inArray(categories.id, currentSolved));

    const difficultyPoints = solvedCats.reduce(
      (sum, c) => sum + (DIFFICULTY_POINTS[c.difficulty] ?? 0),
      0
    );
    const score = computeScore("WON", session.start_time, endTime, newMistakes, difficultyPoints);

    await db
      .update(gameSessions)
      .set({ mistakes: newMistakes, revealed_groups: JSON.stringify(newRevealedIds), status: "WON", end_time: endTime, score })
      .where(eq(gameSessions.id, sessionId));

    return { correct: false, gameOver: true, status: "WON", score, mistakes: newMistakes, revealed: revealedGroup };
  }

  // Normal wrong guess — persist and return
  await db
    .update(gameSessions)
    .set({ mistakes: newMistakes, revealed_groups: JSON.stringify(newRevealedIds) })
    .where(eq(gameSessions.id, sessionId));

  return { correct: false, gameOver: false, mistakes: newMistakes, revealed: revealedGroup };
}
