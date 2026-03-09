"use client";

import { useTransition } from "react";
import { setActivePuzzle } from "@/actions/admin";

interface Puzzle {
  id: string;
  title: string;
  is_active: boolean;
  created_at: Date;
}

export default function PuzzleList({ puzzles }: { puzzles: Puzzle[] }) {
  const [isPending, startTransition] = useTransition();

  function activate(id: string) {
    startTransition(async () => {
      await setActivePuzzle(id);
      // Server action mutates DB; refresh the route to show updated state
      window.location.reload();
    });
  }

  if (puzzles.length === 0) {
    return <p style={{ color: "var(--color-text-muted)", fontSize: "0.875rem" }}>No puzzles yet.</p>;
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem" }}>
      {puzzles.map((p) => (
        <div
          key={p.id}
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: "1rem",
            padding: "0.65rem 0.875rem",
            borderRadius: "var(--radius)",
            border: p.is_active
              ? "1px solid #A0C35A"
              : "1px solid var(--color-border)",
            background: p.is_active ? "rgba(160,195,90,0.07)" : "transparent",
          }}
        >
          <div style={{ display: "flex", flexDirection: "column", gap: "0.1rem" }}>
            <span style={{ fontWeight: p.is_active ? 700 : 400, fontSize: "0.9rem" }}>
              {p.title}
              {p.is_active && (
                <span
                  style={{
                    marginLeft: "0.5rem",
                    fontSize: "0.72rem",
                    color: "#A0C35A",
                    fontWeight: 600,
                    textTransform: "uppercase",
                    letterSpacing: "0.06em",
                  }}
                >
                  Active
                </span>
              )}
            </span>
            <span style={{ fontSize: "0.75rem", color: "var(--color-text-muted)" }}>
              {new Date(p.created_at).toLocaleDateString()}
            </span>
          </div>

          {!p.is_active && (
            <button
              onClick={() => activate(p.id)}
              disabled={isPending}
              style={{
                padding: "0.35rem 0.8rem",
                borderRadius: "var(--radius)",
                border: "1px solid var(--color-border)",
                background: "transparent",
                color: "var(--color-text)",
                fontSize: "0.8rem",
                cursor: isPending ? "not-allowed" : "pointer",
                opacity: isPending ? 0.5 : 1,
              }}
            >
              Set Active
            </button>
          )}
        </div>
      ))}
    </div>
  );
}
