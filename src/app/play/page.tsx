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
import type { DisplayGroup } from "@/components/game/Board";

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
  // category_id is used server-side only for group reconstruction below;
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

  const solvedCategoryIds = JSON.parse(session.solved_groups) as string[];
  const revealedCategoryIds = JSON.parse(session.revealed_groups) as string[];

  const lockedCategoryIds = [...solvedCategoryIds, ...revealedCategoryIds];

  // Fetch metadata for all locked categories in one query
  let initialDisplayGroups: DisplayGroup[] = [];

  if (lockedCategoryIds.length > 0) {
    const lockedCats = await db
      .select()
      .from(categories)
      .where(inArray(categories.id, lockedCategoryIds));

    // Map in the order they were first locked (solved first, then revealed)
    const catById = new Map(lockedCats.map((c) => [c.id, c]));

    initialDisplayGroups = lockedCategoryIds
      .map((id) => {
        const cat = catById.get(id);
        if (!cat) return null;
        return {
          categoryId: cat.id,
          title: cat.title,
          colorTheme: cat.color_theme,
          wordIds: allWords.filter((w) => w.categoryId === cat.id).map((w) => w.id),
          difficulty: cat.difficulty,
          earned: solvedCategoryIds.includes(id),
        } satisfies DisplayGroup;
      })
      .filter(Boolean) as DisplayGroup[];
  }

  // Strip category info and locked words before sending to client
  const lockedWordIds = new Set(initialDisplayGroups.flatMap((g) => g.wordIds));
  const wordData = shuffle(
    allWords
      .filter((w) => !lockedWordIds.has(w.id))
      .map(({ id, text }) => ({ id, text }))
  );

  return (
    <main
      className="play-main"
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        minHeight: "100vh",
        background: "var(--color-bg)",
      }}
    >
      {/* Top nav bar */}
      <header
        style={{
          width: "100%",
          borderBottom: "1px solid var(--color-border)",
          background: "var(--color-surface)",
          padding: "0.875rem 1.5rem",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          boxShadow: "var(--shadow-xs)",
        }}
      >
        <h1
          style={{
            fontFamily: "var(--font-chomsky)",
            fontSize: "1.4rem",
            fontWeight: 400,
            letterSpacing: "0.01em",
            color: "var(--color-text)",
          }}
        >
          The Akshar Times
        </h1>
      </header>

      {/* Board wrapper */}
      <div
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          padding: "2rem 1rem 3rem",
          width: "100%",
        }}
      >
        <Board
          sessionId={sessionId}
          words={wordData}
          initialDisplayGroups={initialDisplayGroups}
          initialMistakes={session.mistakes}
        />
      </div>
    </main>
  );
}
