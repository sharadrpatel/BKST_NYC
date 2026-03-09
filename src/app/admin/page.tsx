export const dynamic = "force-dynamic";

import { desc, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { gameSessions, players, puzzles, categories, words } from "@/db/schema";
import { adminLogout } from "@/actions/admin";
import PuzzleBuilder from "@/components/admin/PuzzleBuilder";
import PlayerGenerator from "@/components/admin/PlayerGenerator";
import PlayerCreator from "@/components/admin/PlayerCreator";
import PuzzleList from "@/components/admin/PuzzleList";
import SessionsTable from "@/components/admin/SessionsTable";
import LeaderboardReset from "@/components/admin/LeaderboardReset";
import BulkImport from "@/components/admin/BulkImport";

// ---------------------------------------------------------------------------
// Data fetchers
// ---------------------------------------------------------------------------

async function fetchSessions() {
  return db
    .select({
      sessionId: gameSessions.id,
      playerName: players.display_name,
      puzzleTitle: puzzles.title,
      status: gameSessions.status,
      score: gameSessions.score,
      mistakes: gameSessions.mistakes,
      startTime: gameSessions.start_time,
      endTime: gameSessions.end_time,
    })
    .from(gameSessions)
    .innerJoin(players, eq(gameSessions.player_id, players.id))
    .innerJoin(puzzles, eq(gameSessions.puzzle_id, puzzles.id))
    .orderBy(desc(gameSessions.start_time));
}

async function fetchPuzzles() {
  const allPuzzles = await db
    .select({ id: puzzles.id, title: puzzles.title, is_active: puzzles.is_active, created_at: puzzles.created_at })
    .from(puzzles)
    .orderBy(desc(puzzles.created_at));

  if (allPuzzles.length === 0) return [];

  const puzzleIds = allPuzzles.map((p) => p.id);

  const allCategories = await db
    .select()
    .from(categories)
    .where(inArray(categories.puzzle_id, puzzleIds));

  const catIds = allCategories.map((c) => c.id);
  const allWords = catIds.length > 0
    ? await db.select().from(words).where(inArray(words.category_id, catIds))
    : [];

  return allPuzzles.map((p) => ({
    ...p,
    categories: allCategories
      .filter((c) => c.puzzle_id === p.id)
      .sort((a, b) => a.difficulty - b.difficulty)
      .map((c) => ({
        id: c.id,
        title: c.title,
        difficulty: c.difficulty,
        words: allWords
          .filter((w) => w.category_id === c.id)
          .map((w) => ({ id: w.id, text: w.text })),
      })),
  }));
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default async function AdminPage() {
  const [sessions, allPuzzles] = await Promise.all([
    fetchSessions(),
    fetchPuzzles(),
  ]);

  const totalPlayers = await db.$count(players);
  const activePuzzle = allPuzzles.find((p) => p.is_active);
  const completed = sessions.filter((s) => s.status !== "IN_PROGRESS").length;
  const inProgress = sessions.filter((s) => s.status === "IN_PROGRESS").length;

  return (
    <main style={{ padding: "2rem", display: "flex", flexDirection: "column", gap: "2.5rem", maxWidth: 960, margin: "0 auto" }}>

      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h1 style={{ fontSize: "1.5rem", fontWeight: 700 }}>Admin Dashboard</h1>
        <form action={adminLogout}>
          <button
            type="submit"
            style={{
              padding: "0.4rem 0.9rem",
              borderRadius: "var(--radius)",
              border: "1px solid var(--color-border)",
              background: "transparent",
              color: "var(--color-text-muted)",
              fontSize: "0.85rem",
              cursor: "pointer",
            }}
          >
            Log out
          </button>
        </form>
      </div>

      {/* Stats bar */}
      <div style={{ display: "flex", gap: "1.25rem", flexWrap: "wrap" }}>
        {[
          { label: "Total Players", value: totalPlayers },
          { label: "Completed", value: completed },
          { label: "In Progress", value: inProgress },
          { label: "Active Puzzle", value: activePuzzle?.title ?? "None" },
        ].map(({ label, value }) => (
          <div
            key={label}
            style={{
              background: "var(--color-surface)",
              border: "1px solid var(--color-border)",
              borderRadius: "var(--radius)",
              padding: "0.75rem 1.25rem",
              minWidth: 120,
            }}
          >
            <p style={{ fontSize: "0.75rem", color: "var(--color-text-muted)", marginBottom: "0.3rem" }}>
              {label}
            </p>
            <p style={{ fontSize: "1.1rem", fontWeight: 700 }}>{value}</p>
          </div>
        ))}
      </div>

      {/* Puzzle management */}
      <section style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
        <h2 style={{ fontSize: "1.1rem", fontWeight: 700 }}>Puzzles</h2>
        <PuzzleList puzzles={allPuzzles} />
      </section>

      {/* Sessions table */}
      <section style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
        <h2 style={{ fontSize: "1.1rem", fontWeight: 700 }}>
          All Sessions{" "}
          <span style={{ fontWeight: 400, color: "var(--color-text-muted)", fontSize: "0.85rem" }}>
            ({sessions.length})
          </span>
        </h2>
        <SessionsTable sessions={sessions} />
      </section>

      {/* Puzzle builder + Player tools */}
      <div className="admin-tools-grid">
        <PuzzleBuilder />
        <PlayerGenerator />
        <PlayerCreator />
        <BulkImport />
        <LeaderboardReset activePuzzleTitle={activePuzzle?.title ?? null} />
      </div>

    </main>
  );
}
