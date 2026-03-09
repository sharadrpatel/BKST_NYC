"use client";

import { useState, useTransition } from "react";
import { deletePlayerResult } from "@/actions/admin";
import { formatDuration } from "@/lib/math";

interface Session {
  sessionId: string;
  playerName: string;
  puzzleTitle: string;
  status: string;
  score: number | null;
  mistakes: number;
  startTime: Date;
  endTime: Date | null;
}

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

export default function SessionsTable({ sessions }: { sessions: Session[] }) {
  const [isPending, startTransition] = useTransition();
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [deleteErrors, setDeleteErrors] = useState<Record<string, string>>({});
  const [deletedIds, setDeletedIds] = useState<Set<string>>(new Set());

  function handleDelete(sessionId: string) {
    setDeleteErrors((prev) => {
      const next = { ...prev };
      delete next[sessionId];
      return next;
    });
    startTransition(async () => {
      const result = await deletePlayerResult(sessionId);
      if (result.error) {
        setDeleteErrors((prev) => ({ ...prev, [sessionId]: result.error! }));
        setConfirmDeleteId(null);
      } else {
        setDeletedIds((prev) => new Set(prev).add(sessionId));
        setConfirmDeleteId(null);
      }
    });
  }

  const visible = sessions.filter((s) => !deletedIds.has(s.sessionId));

  if (sessions.length === 0) {
    return (
      <p style={{ color: "var(--color-text-muted)", fontSize: "0.875rem" }}>
        No sessions yet.
      </p>
    );
  }

  return (
    <div style={{ overflowX: "auto", borderRadius: "var(--radius)", border: "1px solid var(--color-border)" }}>
      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead>
          <tr>
            {["Player", "Puzzle", "Status", "Score", "Mistakes", "Duration", "Started", ""].map((h) => (
              <th key={h} style={th}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {visible.map((s) => {
            const isConfirming = confirmDeleteId === s.sessionId;
            const error = deleteErrors[s.sessionId];

            return (
              <>
                <tr key={s.sessionId}>
                  <td style={td}>{s.playerName}</td>
                  <td style={{ ...td, color: "var(--color-text-muted)", fontSize: "0.8rem" }}>
                    {s.puzzleTitle}
                  </td>
                  <td style={td}>
                    <span style={{ color: STATUS_COLOR[s.status] ?? "var(--color-text)", fontWeight: 600, fontSize: "0.8rem" }}>
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
                  <td style={{ ...td, textAlign: "right" }}>
                    {!isConfirming ? (
                      <button
                        onClick={() => {
                          setConfirmDeleteId(s.sessionId);
                          setDeleteErrors((prev) => {
                            const next = { ...prev };
                            delete next[s.sessionId];
                            return next;
                          });
                        }}
                        disabled={isPending}
                        style={{
                          padding: "0.25rem 0.6rem",
                          borderRadius: "var(--radius)",
                          border: "1px solid #e94560",
                          background: "transparent",
                          color: "#e94560",
                          fontSize: "0.75rem",
                          cursor: isPending ? "not-allowed" : "pointer",
                          opacity: isPending ? 0.5 : 1,
                        }}
                      >
                        Delete result
                      </button>
                    ) : (
                      <div style={{ display: "flex", gap: "0.3rem", justifyContent: "flex-end" }}>
                        <button
                          onClick={() => handleDelete(s.sessionId)}
                          disabled={isPending}
                          style={{
                            padding: "0.25rem 0.6rem",
                            borderRadius: "var(--radius)",
                            border: "none",
                            background: "#e94560",
                            color: "#fff",
                            fontSize: "0.75rem",
                            fontWeight: 600,
                            cursor: isPending ? "not-allowed" : "pointer",
                            opacity: isPending ? 0.5 : 1,
                          }}
                        >
                          {isPending ? "Deleting…" : "Confirm"}
                        </button>
                        <button
                          onClick={() => setConfirmDeleteId(null)}
                          disabled={isPending}
                          style={{
                            padding: "0.25rem 0.6rem",
                            borderRadius: "var(--radius)",
                            border: "1px solid var(--color-border)",
                            background: "transparent",
                            color: "var(--color-text-muted)",
                            fontSize: "0.75rem",
                            cursor: "pointer",
                          }}
                        >
                          Cancel
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
                {(isConfirming || error) && (
                  <tr key={`${s.sessionId}-warn`}>
                    <td colSpan={8} style={{ ...td, paddingTop: 0, borderBottom: "none" }}>
                      {isConfirming && (
                        <p style={{ fontSize: "0.75rem", color: "#e94560", margin: 0 }}>
                          This will permanently delete {s.playerName}&apos;s result for &ldquo;{s.puzzleTitle}&rdquo;.
                          The player BKID will not be deleted.
                        </p>
                      )}
                      {error && (
                        <p style={{ fontSize: "0.75rem", color: "#e94560", margin: 0 }}>
                          Error: {error}
                        </p>
                      )}
                    </td>
                  </tr>
                )}
              </>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
