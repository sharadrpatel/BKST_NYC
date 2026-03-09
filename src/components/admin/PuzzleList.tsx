"use client";

import { useState, useTransition } from "react";
import { setActivePuzzle, deletePuzzle } from "@/actions/admin";
import PuzzleEditor, { type CategoryData } from "./PuzzleEditor";

interface Puzzle {
  id: string;
  title: string;
  is_active: boolean;
  created_at: Date;
  categories: CategoryData[];
}

export default function PuzzleList({ puzzles }: { puzzles: Puzzle[] }) {
  const [isPending, startTransition] = useTransition();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  function activate(id: string) {
    startTransition(async () => {
      await setActivePuzzle(id);
      window.location.reload();
    });
  }

  function handleDelete(id: string) {
    setDeleteError(null);
    startTransition(async () => {
      const result = await deletePuzzle(id);
      if (result.error) {
        setDeleteError(result.error);
        setConfirmDeleteId(null);
      } else {
        window.location.reload();
      }
    });
  }

  if (puzzles.length === 0) {
    return <p style={{ color: "var(--color-text-muted)", fontSize: "0.875rem" }}>No puzzles yet.</p>;
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem" }}>
      {deleteError && (
        <p style={{ color: "#e94560", fontSize: "0.85rem", padding: "0.5rem 0" }}>
          {deleteError}
        </p>
      )}

      {puzzles.map((p) => (
        <div
          key={p.id}
          style={{
            borderRadius: "var(--radius)",
            border: p.is_active ? "1px solid #A0C35A" : "1px solid var(--color-border)",
            background: p.is_active ? "rgba(160,195,90,0.07)" : "transparent",
            padding: "0.65rem 0.875rem",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "1rem" }}>
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

            <div style={{ display: "flex", gap: "0.4rem", alignItems: "center" }}>
              <button
                onClick={() => {
                  setEditingId(editingId === p.id ? null : p.id);
                  setConfirmDeleteId(null);
                }}
                style={{
                  padding: "0.35rem 0.8rem",
                  borderRadius: "var(--radius)",
                  border: "1px solid var(--color-border)",
                  background: editingId === p.id ? "var(--color-surface)" : "transparent",
                  color: "var(--color-text)",
                  fontSize: "0.8rem",
                  cursor: "pointer",
                }}
              >
                {editingId === p.id ? "Close" : "Edit"}
              </button>

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

              {/* Delete — requires confirmation click */}
              {confirmDeleteId !== p.id ? (
                <button
                  onClick={() => {
                    setConfirmDeleteId(p.id);
                    setDeleteError(null);
                  }}
                  disabled={isPending}
                  style={{
                    padding: "0.35rem 0.8rem",
                    borderRadius: "var(--radius)",
                    border: "1px solid #e94560",
                    background: "transparent",
                    color: "#e94560",
                    fontSize: "0.8rem",
                    cursor: isPending ? "not-allowed" : "pointer",
                    opacity: isPending ? 0.5 : 1,
                  }}
                >
                  Delete
                </button>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: "0.3rem" }}>
                  <p style={{ fontSize: "0.75rem", color: "#e94560", fontWeight: 600, margin: 0 }}>
                    This will permanently delete ALL scores and results for this puzzle.
                  </p>
                  <div style={{ display: "flex", gap: "0.4rem" }}>
                    <button
                      onClick={() => handleDelete(p.id)}
                      disabled={isPending}
                      style={{
                        padding: "0.35rem 0.8rem",
                        borderRadius: "var(--radius)",
                        border: "none",
                        background: "#e94560",
                        color: "#fff",
                        fontSize: "0.8rem",
                        fontWeight: 600,
                        cursor: isPending ? "not-allowed" : "pointer",
                        opacity: isPending ? 0.5 : 1,
                      }}
                    >
                      {isPending ? "Deleting…" : "Yes, delete everything"}
                    </button>
                    <button
                      onClick={() => setConfirmDeleteId(null)}
                      disabled={isPending}
                      style={{
                        padding: "0.35rem 0.8rem",
                        borderRadius: "var(--radius)",
                        border: "1px solid var(--color-border)",
                        background: "transparent",
                        color: "var(--color-text-muted)",
                        fontSize: "0.8rem",
                        cursor: "pointer",
                      }}
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>

          {editingId === p.id && (
            <PuzzleEditor
              puzzleId={p.id}
              initialTitle={p.title}
              initialCategories={p.categories}
              onSaved={() => window.location.reload()}
            />
          )}
        </div>
      ))}
    </div>
  );
}
