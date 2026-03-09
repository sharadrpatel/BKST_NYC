// Public Server Component — no auth required.
// Reads the session cookie only to highlight the current player's row.

import { eq, or, desc, asc } from "drizzle-orm";
import { db } from "@/db";
import { gameSessions, players } from "@/db/schema";
import { getSessionId } from "@/lib/session";
import { formatDuration } from "@/lib/math";

// ---------------------------------------------------------------------------
// Data
// ---------------------------------------------------------------------------

async function fetchRows() {
  return db
    .select({
      sessionId: gameSessions.id,
      playerName: players.display_name,
      score: gameSessions.score,
      status: gameSessions.status,
      mistakes: gameSessions.mistakes,
      startTime: gameSessions.start_time,
      endTime: gameSessions.end_time,
    })
    .from(gameSessions)
    .innerJoin(players, eq(gameSessions.player_id, players.id))
    .where(
      or(eq(gameSessions.status, "WON"), eq(gameSessions.status, "LOST"))
    )
    // Primary: score DESC (WON scores > 0 float to top; LOST = 0 sink)
    // Tiebreaker: end_time ASC (faster solver wins)
    .orderBy(desc(gameSessions.score), asc(gameSessions.end_time));
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const STATUS_LABEL: Record<string, string> = {
  WON: "✓ Won",
  LOST: "✗ Lost",
};

const STATUS_COLOR: Record<string, string> = {
  WON: "#A0C35A",
  LOST: "#e94560",
};

const MEDAL: Record<number, string> = { 1: "🥇", 2: "🥈", 3: "🥉" };

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default async function LeaderboardPage() {
  const [rows, mySessionId] = await Promise.all([
    fetchRows(),
    getSessionId(),
  ]);

  const myRow = mySessionId
    ? rows.find((r) => r.sessionId === mySessionId)
    : null;

  return (
    <main
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        padding: "2.5rem 1rem 4rem",
        minHeight: "100vh",
        gap: "2rem",
      }}
    >
      <div style={{ textAlign: "center" }}>
        <h1 style={{ fontSize: "1.75rem", fontWeight: 700, letterSpacing: "-0.02em" }}>
          Leaderboard
        </h1>
        <p style={{ color: "var(--color-text-muted)", fontSize: "0.9rem", marginTop: "0.35rem" }}>
          {rows.length} completed session{rows.length !== 1 ? "s" : ""}
        </p>
      </div>

      {/* "Your result" banner — shown only if the player just finished */}
      {myRow && (
        <div
          style={{
            width: "100%",
            maxWidth: 640,
            background: "var(--color-surface)",
            border: "1px solid rgba(255,255,255,0.12)",
            borderRadius: "var(--radius)",
            padding: "1rem 1.25rem",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: "1rem",
          }}
        >
          <div>
            <p style={{ fontWeight: 700, fontSize: "1rem" }}>{myRow.playerName}</p>
            <p style={{ color: "var(--color-text-muted)", fontSize: "0.85rem", marginTop: "0.2rem" }}>
              Your result
            </p>
          </div>
          <div style={{ textAlign: "right" }}>
            <p
              style={{
                fontSize: "1.6rem",
                fontWeight: 800,
                color: myRow.status === "WON" ? "#A0C35A" : "#e94560",
              }}
            >
              {myRow.score ?? 0}
            </p>
            <p style={{ color: "var(--color-text-muted)", fontSize: "0.8rem" }}>
              {myRow.status === "WON" && myRow.endTime
                ? formatDuration(myRow.startTime, myRow.endTime)
                : STATUS_LABEL[myRow.status]}
            </p>
          </div>
        </div>
      )}

      {/* Rankings table */}
      {rows.length === 0 ? (
        <p style={{ color: "var(--color-text-muted)" }}>
          No completed games yet. Be the first!
        </p>
      ) : (
        <div style={{ width: "100%", maxWidth: 640 }}>
          {/* Scrollable wrapper — lets the fixed-width grid scroll on narrow viewports */}
          <div className="leaderboard-scroll">
          <div className="leaderboard-table">
          {/* Header */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "2.5rem 1fr 5rem 5rem 5rem 4.5rem",
              gap: "0.5rem",
              padding: "0 0.75rem 0.5rem",
              color: "var(--color-text-muted)",
              fontSize: "0.75rem",
              textTransform: "uppercase",
              letterSpacing: "0.06em",
              borderBottom: "1px solid var(--color-border)",
            }}
          >
            <span>#</span>
            <span>Player</span>
            <span style={{ textAlign: "right" }}>Score</span>
            <span style={{ textAlign: "right" }}>Time</span>
            <span style={{ textAlign: "right" }}>Mistakes</span>
            <span style={{ textAlign: "right" }}>Result</span>
          </div>

          {/* Rows */}
          {rows.map((row, i) => {
            const rank = i + 1;
            const isMe = row.sessionId === mySessionId;
            const duration =
              row.endTime ? formatDuration(row.startTime, row.endTime) : "—";

            return (
              <div
                key={row.sessionId}
                style={{
                  display: "grid",
                  gridTemplateColumns: "2.5rem 1fr 5rem 5rem 5rem 4.5rem",
                  gap: "0.5rem",
                  padding: "0.75rem",
                  borderRadius: "var(--radius)",
                  background: isMe
                    ? "rgba(255,255,255,0.05)"
                    : "transparent",
                  border: isMe
                    ? "1px solid rgba(255,255,255,0.1)"
                    : "1px solid transparent",
                  alignItems: "center",
                  marginTop: "0.25rem",
                  fontSize: "0.9rem",
                }}
              >
                <span style={{ fontWeight: 700, color: "var(--color-text-muted)" }}>
                  {MEDAL[rank] ?? rank}
                </span>
                <span style={{ fontWeight: isMe ? 700 : 400 }}>
                  {row.playerName}
                  {isMe && (
                    <span
                      style={{
                        marginLeft: "0.4rem",
                        fontSize: "0.7rem",
                        color: "var(--color-text-muted)",
                        fontWeight: 400,
                      }}
                    >
                      (you)
                    </span>
                  )}
                </span>
                <span style={{ textAlign: "right", fontWeight: 700 }}>
                  {row.score ?? 0}
                </span>
                <span style={{ textAlign: "right", color: "var(--color-text-muted)" }}>
                  {row.status === "WON" ? duration : "—"}
                </span>
                <span style={{ textAlign: "right", color: "var(--color-text-muted)" }}>
                  {row.mistakes}
                </span>
                <span
                  style={{
                    textAlign: "right",
                    fontWeight: 600,
                    fontSize: "0.8rem",
                    color: STATUS_COLOR[row.status] ?? "var(--color-text-muted)",
                  }}
                >
                  {STATUS_LABEL[row.status] ?? row.status}
                </span>
              </div>
            );
          })}
          </div>{/* leaderboard-table */}
          </div>{/* leaderboard-scroll */}
        </div>
      )}

      <a
        href="/"
        style={{
          color: "var(--color-text-muted)",
          fontSize: "0.85rem",
          borderBottom: "1px solid var(--color-border)",
          paddingBottom: "1px",
        }}
      >
        ← Back to home
      </a>
    </main>
  );
}
