"use client";

import { useState, useTransition } from "react";
import { updatePuzzle } from "@/actions/admin";

export interface WordData { id: string; text: string }
export interface CategoryData { id: string; title: string; difficulty: number; words: WordData[] }
export interface PuzzleEditorProps {
  puzzleId: string;
  initialTitle: string;
  initialCategories: CategoryData[];
  onSaved?: () => void;
}

const DIFFICULTY_COLORS: Record<number, string> = {
  1: "#F9DF6D",
  2: "#A0C35A",
  3: "#B0C4EF",
  4: "#BA81C5",
};

const inputStyle: React.CSSProperties = {
  padding: "0.5rem 0.75rem",
  borderRadius: "var(--radius)",
  border: "1px solid var(--color-border)",
  background: "var(--color-surface)",
  color: "var(--color-text)",
  fontSize: "0.875rem",
  width: "100%",
};

export default function PuzzleEditor({
  puzzleId,
  initialTitle,
  initialCategories,
  onSaved,
}: PuzzleEditorProps) {
  const [isPending, startTransition] = useTransition();
  const [title, setTitle] = useState(initialTitle);
  const [cats, setCats] = useState<CategoryData[]>(
    initialCategories.map((c) => ({ ...c, words: c.words.map((w) => ({ ...w })) }))
  );
  const [result, setResult] = useState<{ ok: true } | { ok: false; msg: string } | null>(null);

  function updateCatTitle(i: number, val: string) {
    setCats((prev) => prev.map((c, idx) => (idx === i ? { ...c, title: val } : c)));
  }

  function updateWord(catIdx: number, wordIdx: number, val: string) {
    setCats((prev) =>
      prev.map((c, i) => {
        if (i !== catIdx) return c;
        const words = c.words.map((w, wi) => (wi === wordIdx ? { ...w, text: val } : w));
        return { ...c, words };
      })
    );
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setResult(null);
    startTransition(async () => {
      try {
        await updatePuzzle({
          puzzleId,
          title,
          categories: cats.map((c) => ({
            id: c.id,
            title: c.title,
            words: c.words.map((w) => ({ id: w.id, text: w.text })),
          })),
        });
        setResult({ ok: true });
        onSaved?.();
      } catch (err) {
        setResult({ ok: false, msg: (err as Error).message });
      }
    });
  }

  return (
    <form
      onSubmit={handleSubmit}
      style={{ display: "flex", flexDirection: "column", gap: "1rem", marginTop: "0.75rem" }}
    >
      <div>
        <label style={{ display: "block", fontSize: "0.75rem", color: "var(--color-text-muted)", marginBottom: "0.25rem" }}>
          Puzzle Title
        </label>
        <input
          style={inputStyle}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          required
        />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
        {cats.map((cat, ci) => (
          <div
            key={cat.id}
            style={{
              border: `2px solid ${DIFFICULTY_COLORS[cat.difficulty] ?? "var(--color-border)"}`,
              borderRadius: "var(--radius)",
              padding: "0.75rem",
              display: "flex",
              flexDirection: "column",
              gap: "0.5rem",
            }}
          >
            <input
              style={inputStyle}
              value={cat.title}
              onChange={(e) => updateCatTitle(ci, e.target.value)}
              placeholder="Category name"
              required
            />
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.35rem" }}>
              {cat.words.map((w, wi) => (
                <input
                  key={w.id}
                  style={inputStyle}
                  value={w.text}
                  onChange={(e) => updateWord(ci, wi, e.target.value)}
                  placeholder={`Word ${wi + 1}`}
                  required
                />
              ))}
            </div>
          </div>
        ))}
      </div>

      {result && (
        <p style={{ color: result.ok ? "#A0C35A" : "#e94560", fontSize: "0.85rem" }}>
          {result.ok ? "✓ Saved." : `Error: ${result.msg}`}
        </p>
      )}

      <button
        type="submit"
        disabled={isPending}
        style={{
          padding: "0.5rem 1rem",
          borderRadius: "var(--radius)",
          border: "none",
          background: isPending ? "var(--color-text-muted)" : "var(--color-card-selected)",
          color: "#fff",
          fontWeight: 600,
          fontSize: "0.875rem",
          cursor: isPending ? "not-allowed" : "pointer",
          alignSelf: "flex-start",
        }}
      >
        {isPending ? "Saving…" : "Save Changes"}
      </button>
    </form>
  );
}
