"use server";

import { db } from "@/db";
import { gameSessions, words, categories, guesses } from "@/db/schema";
import { eq, inArray } from "drizzle-orm";
import { computeScore } from "@/lib/math";

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
    }
  // Correct guess, player wins
  | {
      correct: true;
      gameOver: true;
      status: "WON";
      score: number;
      categoryId: string;
      categoryTitle: string;
      colorTheme: string;
      wordIds: string[];
    }
  // Wrong guess, game continues
  | { correct: false; gameOver: false; mistakes: number }
  // Wrong guess, player loses (4 mistakes)
  | { correct: false; gameOver: true; status: "LOST"; mistakes: number };

// ---------------------------------------------------------------------------
// submitGuess
//
// Security properties:
//   - Guess row is written to DB BEFORE the response is returned.
//     A page refresh cannot erase the mistake.
//   - Category metadata is returned ONLY after a group is correctly solved.
//   - start_time and end_time are fully server-authoritative.
// ---------------------------------------------------------------------------

export async function submitGuess(
  sessionId: string,
  wordIds: string[]
): Promise<GuessResult> {
  if (wordIds.length !== 4) {
    throw new Error("Exactly 4 word IDs required.");
  }

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

  // 5. Branch: correct guess
  if (isCorrect) {
    const categoryId = uniqueCategories[0];

    const currentSolved = JSON.parse(session.solved_groups) as string[];
    const newSolved = [...currentSolved, categoryId];
    const isWon = newSolved.length === 4;

    // Fetch the category metadata — safe to return now that it's solved
    const [cat] = await db
      .select()
      .from(categories)
      .where(eq(categories.id, categoryId))
      .limit(1);

    if (isWon) {
      const endTime = new Date();
      const score = computeScore("WON", session.start_time, endTime, session.mistakes);

      await db
        .update(gameSessions)
        .set({
          solved_groups: JSON.stringify(newSolved),
          status: "WON",
          end_time: endTime,
          score,
        })
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
    };
  }

  // 6. Branch: wrong guess
  const newMistakes = session.mistakes + 1;
  const isLost = newMistakes >= 4;

  if (isLost) {
    const endTime = new Date();
    await db
      .update(gameSessions)
      .set({ mistakes: newMistakes, status: "LOST", end_time: endTime, score: 0 })
      .where(eq(gameSessions.id, sessionId));

    return { correct: false, gameOver: true, status: "LOST", mistakes: newMistakes };
  }

  await db
    .update(gameSessions)
    .set({ mistakes: newMistakes })
    .where(eq(gameSessions.id, sessionId));

  return { correct: false, gameOver: false, mistakes: newMistakes };
}
