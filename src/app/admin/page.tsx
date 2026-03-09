import { desc } from "drizzle-orm";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { gameSessions, players, puzzles } from "@/db/schema";
import { formatDuration } from "@/lib/math";
import { adminLogout } from "@/actions/admin";
import PuzzleBuilder from "@/components/admin/PuzzleBuilder";
import PlayerGenerator from "@/components/admin/PlayerGenerator";
import PuzzleList from "@/components/admin/PuzzleList";

// ---------------------------------------------------------------------------
// Data fetchers
// ---------------------------------------------------------------------------

async function fetchSessions() {
  return db
    .select({
      sessionId: gameSessions.id,
      playerName: players.display_name,
      status: gameSessions.status,
      score: gameSessions.score,
      mistakes: gameSessions.mistakes,
      startTime: gameSessions.start_time,
      endTime: gameSessions.end_time,
    })
    .from(gameSessions)
    .innerJoin(players, eq(gameSessions.player_id, players.id))
    .orderBy(desc(gameSessions.start_time));
}

async function fetchPuzzles() {
  return db
    .select({
      id: puzzles.id,
      title: puzzles.title,
      is_active: puzzles.is_active,
      created_at: puzzles.created_at,
    })
    .from(puzzles)
    .orderBy(desc(puzzles.created_at));
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const STATUS_COLOR: Record<string, string> = {
  IN_PROGRESS: "#B0C4EF",
  WON: "#A0C35A",
  LOST: "#e94560",
};

const th: React.CSSProperties = {
  padding: "0.5rem 0.75rem",
  textAlign: "left",
  fontWeight: 600,
  fontSize: "0.75rem",
  textTransform: "uppercase",
  letterSpacing: "0.06em",
  color: "var(--color-text-muted)",
  borderBottom: "1px solid var(--color-border)",
  whiteSpace: "nowrap",
};

const td: React.CSSProperties = {
  padding: "0.6rem 0.75rem",
  fontSize: "0.875rem",
  borderBottom: "1px solid rgba(255,255,255,0.04)",
  whiteSpace: "nowrap",
};

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

        {sessions.length === 0 ? (
          <p style={{ color: "var(--color-text-muted)", fontSize: "0.875rem" }}>No sessions yet.</p>
        ) : (
          <div style={{ overflowX: "auto", borderRadius: "var(--radius)", border: "1px solid var(--color-border)" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr>
                  {["Player", "Status", "Score", "Mistakes", "Duration", "Started"].map((h) => (
                    <th key={h} style={th}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {sessions.map((s) => (
                  <tr key={s.sessionId}>
                    <td style={td}>{s.playerName}</td>
                    <td style={td}>
                      <span
                        style={{
                          color: STATUS_COLOR[s.status] ?? "var(--color-text)",
                          fontWeight: 600,
                          fontSize: "0.8rem",
                        }}
                      >
                        {s.status}
                      </span>
                    </td>
                    <td style={{ ...td, fontWeight: 700 }}>{s.score ?? "—"}</td>
                    <td style={td}>{s.mistakes}</td>
                    <td style={{ ...td, color: "var(--color-text-muted)" }}>
                      {s.endTime ? formatDuration(s.startTime, s.endTime) : "ongoing"}
                    </td>
                    <td style={{ ...td, color: "var(--color-text-muted)" }}>
                      {new Date(s.startTime).toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Puzzle builder + Player generator — side by side on desktop, stacked on mobile */}
      <div className="admin-tools-grid">
        <PuzzleBuilder />
        <PlayerGenerator />
      </div>

    </main>
  );
}
