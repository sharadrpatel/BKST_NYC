// Server Component — fetches session + words, renders Board client component.
// Route protection (redirect if no valid session) is enforced here.
// Category metadata is NEVER included in wordData — only id + text are passed.

export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { gameSessions, words, categories } from "@/db/schema";
import { getSessionId } from "@/lib/session";
import { shuffle } from "@/lib/utils";
import Board from "@/components/game/Board";

export default async function PlayPage() {
  const sessionId = await getSessionId();
  if (!sessionId) redirect("/");

  const [session] = await db
    .select()
    .from(gameSessions)
    .where(eq(gameSessions.id, sessionId))
    .limit(1);

  if (!session) redirect("/");
  if (session.status !== "IN_PROGRESS") redirect("/leaderboard");

  // Fetch all 16 words for this puzzle with their category IDs.
  // category_id is used server-side only for solved-group reconstruction below;
  // it is NOT forwarded to the client.
  const allWords = await db
    .select({
      id: words.id,
      text: words.text,
      categoryId: words.category_id,
    })
    .from(words)
    .innerJoin(categories, eq(words.category_id, categories.id))
    .where(eq(categories.puzzle_id, session.puzzle_id));

  // Reconstruct already-solved groups so the board renders correctly on refresh
  const solvedCategoryIds = JSON.parse(session.solved_groups) as string[];

  type SolvedGroup = {
    categoryId: string;
    title: string;
    colorTheme: string;
    wordIds: string[];
  };

  let initialSolvedGroups: SolvedGroup[] = [];

  if (solvedCategoryIds.length > 0) {
    const solvedCats = await db
      .select()
      .from(categories)
      .where(inArray(categories.id, solvedCategoryIds));

    initialSolvedGroups = solvedCats.map((cat) => ({
      categoryId: cat.id,
      title: cat.title,
      colorTheme: cat.color_theme,
      wordIds: allWords
        .filter((w) => w.categoryId === cat.id)
        .map((w) => w.id),
    }));
  }

  // Strip category info before sending to client
  const solvedWordIds = new Set(initialSolvedGroups.flatMap((g) => g.wordIds));
  const wordData = shuffle(
    allWords
      .filter((w) => !solvedWordIds.has(w.id))
      .map(({ id, text }) => ({ id, text }))
  );

  return (
    <main
      className="play-main"
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        padding: "2rem 1rem",
        minHeight: "100vh",
        gap: "1.5rem",
      }}
    >
      <h1 style={{ fontSize: "1.5rem", fontWeight: 700 }}>BKST NYC</h1>
      <Board
        sessionId={sessionId}
        words={wordData}
        initialSolvedGroups={initialSolvedGroups}
        initialMistakes={session.mistakes}
      />
    </main>
  );
}
