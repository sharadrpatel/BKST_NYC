export const dynamic = "force-dynamic";

import { desc, eq, inArray, count, asc } from "drizzle-orm";
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
import PlayerManager, { type PlayerRow } from "@/components/admin/PlayerManager";

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

async function fetchPlayers(activePuzzleId: string | null): Promise<PlayerRow[]> {
  const [allPlayers, sessionCounts, activeSessions] = await Promise.all([
    db.select().from(players).orderBy(asc(players.display_name)),
    db
      .select({ player_id: gameSessions.player_id, cnt: count(gameSessions.id) })
      .from(gameSessions)
      .groupBy(gameSessions.player_id),
    activePuzzleId
      ? db
          .select({ player_id: gameSessions.player_id })
          .from(gameSessions)
          .where(eq(gameSessions.puzzle_id, activePuzzleId))
      : Promise.resolve([] as { player_id: string }[]),
  ]);

  const countMap = new Map(sessionCounts.map((s) => [s.player_id, s.cnt]));
  const activeSet = new Set(activeSessions.map((s) => s.player_id));

  return allPlayers.map((p) => ({
    id: p.id,
    display_name: p.display_name,
    access_code: p.access_code,
    mode: p.mode as "scored" | "test",
    sessionCount: countMap.get(p.id) ?? 0,
    hasActiveSession: activeSet.has(p.id),
  }));
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

  const activePuzzle = allPuzzles.find((p) => p.is_active);
  const allPlayers = await fetchPlayers(activePuzzle?.id ?? null);

  const totalPlayers = allPlayers.length;
  const scoredPlayers = allPlayers.filter((p) => p.mode === "scored").length;
  const testPlayers = allPlayers.filter((p) => p.mode === "test").length;
  const completed = sessions.filter((s) => s.status !== "IN_PROGRESS").length;
  const inProgress = sessions.filter((s) => s.status === "IN_PROGRESS").length;

  const stats = [
    { label: "Total Players", value: totalPlayers, sub: `${scoredPlayers} scored · ${testPlayers} test` },
    { label: "Completed", value: completed },
    { label: "In Progress", value: inProgress },
    { label: "Active Puzzle", value: activePuzzle?.title ?? "None", highlight: !!activePuzzle },
  ];

  return (
    <main
      style={{
        padding: "0",
        minHeight: "100vh",
        background: "var(--color-bg)",
      }}
    >
      {/* Admin nav bar */}
      <header
        style={{
          background: "var(--color-surface)",
          borderBottom: "1px solid var(--color-border)",
          padding: "0.875rem 2rem",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          boxShadow: "var(--shadow-xs)",
          position: "sticky",
          top: 0,
          zIndex: 10,
        }}
      >
        <div>
          <h1
            style={{
              fontSize: "1rem",
              fontWeight: 800,
              letterSpacing: "-0.02em",
              color: "var(--color-text)",
            }}
          >
            The Akshar Times
          </h1>
          <p
            style={{
              fontSize: "0.72rem",
              color: "var(--color-text-muted)",
              fontWeight: 500,
              letterSpacing: "0.06em",
              textTransform: "uppercase",
              marginTop: "0.1rem",
            }}
          >
            Admin Dashboard
          </p>
        </div>
        <form action={adminLogout}>
          <button
            type="submit"
            style={{
              padding: "0.45rem 0.9rem",
              borderRadius: "var(--radius-sm)",
              border: "1px solid var(--color-border-strong)",
              background: "transparent",
              color: "var(--color-text-muted)",
              fontSize: "0.82rem",
              fontWeight: 500,
              cursor: "pointer",
              transition: "background var(--transition), color var(--transition)",
            }}
          >
            Log out
          </button>
        </form>
      </header>

      <div
        style={{
          maxWidth: 1000,
          margin: "0 auto",
          padding: "2rem 1.5rem 4rem",
          display: "flex",
          flexDirection: "column",
          gap: "2.5rem",
        }}
      >
        {/* Stats cards */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
            gap: "1rem",
          }}
        >
          {stats.map(({ label, value, sub, highlight }) => (
            <div
              key={label}
              style={{
                background: "var(--color-surface)",
                border: `1px solid ${highlight ? "rgba(28,28,30,0.2)" : "var(--color-border)"}`,
                borderRadius: "var(--radius-md)",
                padding: "1.25rem 1.25rem 1rem",
                boxShadow: "var(--shadow-xs)",
              }}
            >
              <p
                style={{
                  fontSize: "0.68rem",
                  fontWeight: 600,
                  color: "var(--color-text-muted)",
                  textTransform: "uppercase",
                  letterSpacing: "0.1em",
                  marginBottom: "0.4rem",
                }}
              >
                {label}
              </p>
              <p
                style={{
                  fontSize: typeof value === "number" ? "1.75rem" : "1rem",
                  fontWeight: 800,
                  letterSpacing: typeof value === "number" ? "-0.04em" : "-0.01em",
                  lineHeight: 1.1,
                  color: highlight ? "var(--color-text)" : "var(--color-text)",
                }}
              >
                {value}
              </p>
              {sub && (
                <p
                  style={{
                    fontSize: "0.72rem",
                    color: "var(--color-text-muted)",
                    marginTop: "0.3rem",
                    fontWeight: 400,
                  }}
                >
                  {sub}
                </p>
              )}
            </div>
          ))}
        </div>

        {/* Puzzle management */}
        <section style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
          <div className="admin-section-header">
            <h2 style={{ fontSize: "1rem", fontWeight: 700 }}>Puzzles</h2>
          </div>
          <PuzzleList puzzles={allPuzzles} />
        </section>

        {/* Player management */}
        <PlayerManager initialPlayers={allPlayers} />

        {/* Sessions table */}
        <section style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
          <div className="admin-section-header">
            <h2 style={{ fontSize: "1rem", fontWeight: 700 }}>All Sessions</h2>
            <span
              style={{
                fontSize: "0.75rem",
                color: "var(--color-text-muted)",
                background: "var(--color-card)",
                padding: "0.15rem 0.5rem",
                borderRadius: "var(--radius-sm)",
                fontWeight: 500,
              }}
            >
              {sessions.length}
            </span>
          </div>
          <SessionsTable sessions={sessions} />
        </section>

        {/* Builder / tools grid */}
        <section style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
          <div className="admin-section-header">
            <h2 style={{ fontSize: "1rem", fontWeight: 700 }}>Tools</h2>
          </div>
          <div className="admin-tools-grid">
            <PuzzleBuilder />
            <PlayerGenerator />
            <PlayerCreator />
            <BulkImport />
            <LeaderboardReset activePuzzleTitle={activePuzzle?.title ?? null} />
          </div>
        </section>
      </div>
    </main>
  );
}
