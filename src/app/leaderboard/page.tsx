// Public Server Component — no auth required.
// Reads the session cookie only to highlight the current player's row.

import Link from "next/link";
import { eq, or, desc, asc, and } from "drizzle-orm";
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
      and(
        or(eq(gameSessions.status, "WON"), eq(gameSessions.status, "LOST")),
        eq(gameSessions.is_test, false)
      )
    )
    // Primary: score DESC (WON scores > 0 float to top; LOST = 0 sink)
    // Tiebreaker: end_time ASC (faster solver wins)
    .orderBy(desc(gameSessions.score), asc(gameSessions.end_time));
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const STATUS_LABEL: Record<string, string> = {
  WON: "Won",
  LOST: "Lost",
};

const STATUS_COLOR: Record<string, string> = {
  WON: "var(--color-success)",
  LOST: "var(--color-error)",
};

const STATUS_BG: Record<string, string> = {
  WON: "var(--color-success-bg)",
  LOST: "var(--color-error-bg)",
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
            fontSize: "1.15rem",
            fontWeight: 800,
            letterSpacing: "-0.03em",
            color: "var(--color-text)",
          }}
        >
          The Akshar Times
        </h1>
      </header>

      <div
        style={{
          width: "100%",
          maxWidth: 640,
          padding: "2.5rem 1rem 4rem",
          display: "flex",
          flexDirection: "column",
          gap: "1.75rem",
        }}
      >
        {/* Page heading */}
        <div>
          <h2
            style={{
              fontSize: "1.75rem",
              fontWeight: 800,
              letterSpacing: "-0.03em",
              color: "var(--color-text)",
            }}
          >
            Leaderboard
          </h2>
          <p
            style={{
              color: "var(--color-text-muted)",
              fontSize: "0.875rem",
              marginTop: "0.3rem",
            }}
          >
            {rows.length} completed session{rows.length !== 1 ? "s" : ""}
          </p>
          {mySessionId && (
            <Link
              href="/play/review"
              style={{
                display: "inline-block",
                marginTop: "0.5rem",
                fontSize: "0.82rem",
                fontWeight: 600,
                color: "var(--color-text-muted)",
                textDecoration: "underline",
                textUnderlineOffset: "2px",
              }}
            >
              Review your completed puzzle
            </Link>
          )}
        </div>

        {/* "Your result" banner */}
        {myRow && (
          <div
            style={{
              background: "var(--color-surface)",
              border: "1px solid var(--color-border)",
              borderRadius: "var(--radius-md)",
              padding: "1.25rem 1.5rem",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              gap: "1rem",
              boxShadow: "var(--shadow-sm)",
            }}
          >
            <div>
              <p
                style={{
                  fontSize: "0.7rem",
                  fontWeight: 600,
                  letterSpacing: "0.1em",
                  textTransform: "uppercase",
                  color: "var(--color-text-muted)",
                  marginBottom: "0.35rem",
                }}
              >
                Your result
              </p>
              <p style={{ fontWeight: 700, fontSize: "1.05rem" }}>{myRow.playerName}</p>
            </div>
            <div style={{ textAlign: "right" }}>
              <p
                style={{
                  fontSize: "2rem",
                  fontWeight: 800,
                  letterSpacing: "-0.03em",
                  color: myRow.status === "WON" ? "var(--color-success)" : "var(--color-error)",
                  lineHeight: 1,
                }}
              >
                {myRow.score ?? 0}
              </p>
              <p
                style={{
                  color: "var(--color-text-muted)",
                  fontSize: "0.8rem",
                  marginTop: "0.3rem",
                }}
              >
                {myRow.status === "WON" && myRow.endTime
                  ? formatDuration(myRow.startTime, myRow.endTime)
                  : STATUS_LABEL[myRow.status]}
              </p>
            </div>
          </div>
        )}

        {/* Rankings table */}
        {rows.length === 0 ? (
          <div
            style={{
              background: "var(--color-surface)",
              border: "1px solid var(--color-border)",
              borderRadius: "var(--radius-md)",
              padding: "3rem 2rem",
              textAlign: "center",
              boxShadow: "var(--shadow-xs)",
            }}
          >
            <p
              style={{
                fontSize: "1.5rem",
                marginBottom: "0.5rem",
              }}
            >
              🎮
            </p>
            <p style={{ fontWeight: 600, marginBottom: "0.35rem" }}>No results yet</p>
            <p style={{ color: "var(--color-text-muted)", fontSize: "0.875rem" }}>
              Be the first to complete the puzzle!
            </p>
          </div>
        ) : (
          <div className="leaderboard-scroll">
            <div className="leaderboard-table">
              {/* Header */}
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "2.75rem 1fr 5rem 5rem 4rem 5rem",
                  gap: "0.5rem",
                  padding: "0.75rem 1rem",
                  background: "var(--color-bg)",
                  borderBottom: "1px solid var(--color-border)",
                  color: "var(--color-text-muted)",
                  fontSize: "0.7rem",
                  fontWeight: 600,
                  textTransform: "uppercase",
                  letterSpacing: "0.08em",
                }}
              >
                <span>#</span>
                <span>Player</span>
                <span style={{ textAlign: "right" }}>Score</span>
                <span style={{ textAlign: "right" }}>Time</span>
                <span style={{ textAlign: "right" }}>Misses</span>
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
                    className="leaderboard-row"
                    style={{
                      display: "grid",
                      gridTemplateColumns: "2.75rem 1fr 5rem 5rem 4rem 5rem",
                      gap: "0.5rem",
                      padding: "0.875rem 1rem",
                      borderBottom: i < rows.length - 1 ? "1px solid var(--color-border)" : "none",
                      background: isMe ? "rgba(28, 28, 30, 0.03)" : "transparent",
                      alignItems: "center",
                      fontSize: "0.9rem",
                    }}
                  >
                    <span
                      style={{
                        fontWeight: 700,
                        fontSize: rank <= 3 ? "1.1rem" : "0.85rem",
                        color: rank <= 3 ? "var(--color-text)" : "var(--color-text-muted)",
                        lineHeight: 1,
                      }}
                    >
                      {MEDAL[rank] ?? rank}
                    </span>
                    <span
                      style={{
                        fontWeight: isMe ? 700 : 500,
                        display: "flex",
                        alignItems: "center",
                        gap: "0.4rem",
                        minWidth: 0,
                      }}
                    >
                      <span
                        style={{
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {row.playerName}
                      </span>
                      {isMe && (
                        <span
                          style={{
                            fontSize: "0.65rem",
                            fontWeight: 600,
                            color: "var(--color-text-muted)",
                            background: "var(--color-card)",
                            padding: "0.1rem 0.4rem",
                            borderRadius: "var(--radius-sm)",
                            flexShrink: 0,
                            letterSpacing: "0.04em",
                          }}
                        >
                          you
                        </span>
                      )}
                    </span>
                    <span
                      style={{
                        textAlign: "right",
                        fontWeight: 700,
                        fontSize: "0.95rem",
                      }}
                    >
                      {row.score ?? 0}
                    </span>
                    <span
                      style={{
                        textAlign: "right",
                        color: "var(--color-text-muted)",
                        fontSize: "0.85rem",
                      }}
                    >
                      {row.status === "WON" ? duration : "—"}
                    </span>
                    <span
                      style={{
                        textAlign: "right",
                        color: "var(--color-text-muted)",
                        fontSize: "0.85rem",
                      }}
                    >
                      {row.mistakes}
                    </span>
                    <span style={{ textAlign: "right" }}>
                      <span
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          justifyContent: "center",
                          fontWeight: 600,
                          fontSize: "0.72rem",
                          letterSpacing: "0.04em",
                          color: STATUS_COLOR[row.status] ?? "var(--color-text-muted)",
                          background: STATUS_BG[row.status] ?? "transparent",
                          padding: "0.2rem 0.5rem",
                          borderRadius: "var(--radius-sm)",
                        }}
                      >
                        {STATUS_LABEL[row.status] ?? row.status}
                      </span>
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <a
          href="/"
          style={{
            alignSelf: "flex-start",
            color: "var(--color-text-muted)",
            fontSize: "0.85rem",
            display: "flex",
            alignItems: "center",
            gap: "0.3rem",
            padding: "0.4rem 0",
            transition: "color var(--transition)",
          }}
        >
          ← Back to home
        </a>
      </div>
    </main>
  );
}
