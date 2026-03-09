"use client";

import { useState, useTransition } from "react";
import { resetActivePuzzleLeaderboard } from "@/actions/admin";

export default function LeaderboardReset({
  activePuzzleTitle,
}: {
  activePuzzleTitle: string | null;
}) {
  const [isPending, startTransition] = useTransition();
  const [confirming, setConfirming] = useState(false);
  const [result, setResult] = useState<
    { ok: true; count: number } | { ok: false; msg: string } | null
  >(null);

  function handleReset() {
    setResult(null);
    startTransition(async () => {
      const res = await resetActivePuzzleLeaderboard();
      if (res.error) {
        setResult({ ok: false, msg: res.error });
      } else {
        setResult({ ok: true, count: res.count ?? 0 });
      }
      setConfirming(false);
    });
  }

  return (
    <div
      style={{
        background: "var(--color-surface)",
        border: "1px solid var(--color-border)",
        borderRadius: "var(--radius)",
        padding: "1.25rem",
        display: "flex",
        flexDirection: "column",
        gap: "0.75rem",
      }}
    >
      <h3 style={{ fontSize: "0.95rem", fontWeight: 700 }}>
        Reset Leaderboard
      </h3>

      {activePuzzleTitle ? (
        <p style={{ fontSize: "0.8rem", color: "var(--color-text-muted)", margin: 0 }}>
          Active puzzle:{" "}
          <span style={{ color: "var(--color-text)", fontWeight: 600 }}>
            {activePuzzleTitle}
          </span>
        </p>
      ) : (
        <p style={{ fontSize: "0.8rem", color: "#e94560", margin: 0 }}>
          No active puzzle — nothing to reset.
        </p>
      )}

      {result && (
        <p
          style={{
            fontSize: "0.85rem",
            color: result.ok ? "#A0C35A" : "#e94560",
            margin: 0,
          }}
        >
          {result.ok
            ? `✓ Cleared ${result.count} session${result.count !== 1 ? "s" : ""}. Leaderboard is empty.`
            : `Error: ${result.msg}`}
        </p>
      )}

      {!confirming ? (
        <button
          onClick={() => {
            setResult(null);
            setConfirming(true);
          }}
          disabled={isPending || !activePuzzleTitle}
          style={{
            padding: "0.5rem 1rem",
            borderRadius: "var(--radius)",
            border: "1px solid #e94560",
            background: "transparent",
            color: "#e94560",
            fontWeight: 600,
            fontSize: "0.875rem",
            cursor: !activePuzzleTitle || isPending ? "not-allowed" : "pointer",
            opacity: !activePuzzleTitle || isPending ? 0.4 : 1,
            alignSelf: "flex-start",
          }}
        >
          Reset leaderboard
        </button>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
          <p style={{ fontSize: "0.8rem", color: "#e94560", fontWeight: 600, margin: 0 }}>
            This will permanently delete ALL scores and sessions for &ldquo;{activePuzzleTitle}&rdquo;.
            The puzzle and player BKIDs will not be deleted.
          </p>
          <div style={{ display: "flex", gap: "0.5rem" }}>
            <button
              onClick={handleReset}
              disabled={isPending}
              style={{
                padding: "0.5rem 1rem",
                borderRadius: "var(--radius)",
                border: "none",
                background: "#e94560",
                color: "#fff",
                fontWeight: 600,
                fontSize: "0.875rem",
                cursor: isPending ? "not-allowed" : "pointer",
                opacity: isPending ? 0.5 : 1,
              }}
            >
              {isPending ? "Resetting…" : "Yes, clear all scores"}
            </button>
            <button
              onClick={() => setConfirming(false)}
              disabled={isPending}
              style={{
                padding: "0.5rem 1rem",
                borderRadius: "var(--radius)",
                border: "1px solid var(--color-border)",
                background: "transparent",
                color: "var(--color-text-muted)",
                fontSize: "0.875rem",
                cursor: "pointer",
              }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
