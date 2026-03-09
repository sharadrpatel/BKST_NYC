"use client";

import { useState, useTransition } from "react";
import { createPuzzle } from "@/actions/admin";
import type { CreatePuzzleInput } from "@/actions/admin";

const DIFFICULTIES = [
  { value: 1, label: "1 — Yellow (Easiest)", color: "#F9DF6D" },
  { value: 2, label: "2 — Green",            color: "#A0C35A" },
  { value: 3, label: "3 — Blue",             color: "#B0C4EF" },
  { value: 4, label: "4 — Purple (Hardest)", color: "#BA81C5" },
];

function blankCategory(difficulty: number) {
  return { title: "", difficulty, words: ["", "", "", ""] as [string, string, string, string] };
}

const inputStyle: React.CSSProperties = {
  padding: "0.5rem 0.75rem",
  borderRadius: "var(--radius)",
  border: "1px solid var(--color-border)",
  background: "var(--color-surface)",
  color: "var(--color-text)",
  fontSize: "0.875rem",
  width: "100%",
};

export default function PuzzleBuilder() {
  const [isPending, startTransition] = useTransition();
  const [puzzleTitle, setPuzzleTitle] = useState("");
  const [cats, setCats] = useState(() => [1, 2, 3, 4].map(blankCategory));
  const [result, setResult] = useState<{ ok: true; id: string } | { ok: false; msg: string } | null>(null);

  function updateCatField(
    i: number,
    field: "title" | "difficulty",
    val: string | number
  ) {
    setCats((prev) =>
      prev.map((c, idx) => (idx === i ? { ...c, [field]: val } : c))
    );
  }

  function updateWord(catIdx: number, wordIdx: number, val: string) {
    setCats((prev) =>
      prev.map((c, i) => {
        if (i !== catIdx) return c;
        const words = [...c.words] as [string, string, string, string];
        words[wordIdx] = val;
        return { ...c, words };
      })
    );
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setResult(null);

    const data: CreatePuzzleInput = {
      title: puzzleTitle,
      categories: cats.map((c) => ({
        title: c.title,
        difficulty: c.difficulty,
        words: c.words,
      })),
    };

    startTransition(async () => {
      try {
        const res = await createPuzzle(data);
        setResult({ ok: true, id: res.puzzleId });
        // Reset form
        setPuzzleTitle("");
        setCats([1, 2, 3, 4].map(blankCategory));
      } catch (err) {
        setResult({ ok: false, msg: (err as Error).message });
      }
    });
  }

  return (
    <section style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
      <h2 style={{ fontSize: "1.1rem", fontWeight: 700 }}>Create Puzzle</h2>

      <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
        {/* Puzzle title */}
        <div>
          <label style={{ display: "block", fontSize: "0.8rem", color: "var(--color-text-muted)", marginBottom: "0.3rem" }}>
            Puzzle Title
          </label>
          <input
            style={inputStyle}
            value={puzzleTitle}
            onChange={(e) => setPuzzleTitle(e.target.value)}
            placeholder='e.g. "Company Retreat 2024"'
            required
          />
        </div>

        {/* 4 Categories */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
          {cats.map((cat, ci) => {
            const palette = DIFFICULTIES.find((d) => d.value === cat.difficulty);
            return (
              <div
                key={ci}
                style={{
                  border: `2px solid ${palette?.color ?? "var(--color-border)"}`,
                  borderRadius: "var(--radius)",
                  padding: "0.875rem",
                  display: "flex",
                  flexDirection: "column",
                  gap: "0.6rem",
                }}
              >
                <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
                  <input
                    style={{ ...inputStyle, flex: 1 }}
                    value={cat.title}
                    onChange={(e) => updateCatField(ci, "title", e.target.value)}
                    placeholder="Category name"
                    required
                  />
                  <select
                    style={{ ...inputStyle, width: "auto", flexShrink: 0 }}
                    value={cat.difficulty}
                    onChange={(e) => updateCatField(ci, "difficulty", Number(e.target.value))}
                  >
                    {DIFFICULTIES.map((d) => (
                      <option key={d.value} value={d.value}>
                        D{d.value}
                      </option>
                    ))}
                  </select>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.4rem" }}>
                  {cat.words.map((w, wi) => (
                    <input
                      key={wi}
                      style={inputStyle}
                      value={w}
                      onChange={(e) => updateWord(ci, wi, e.target.value)}
                      placeholder={`Word ${wi + 1}`}
                      required
                    />
                  ))}
                </div>
              </div>
            );
          })}
        </div>

        {/* Result feedback */}
        {result && (
          <p style={{ color: result.ok ? "#A0C35A" : "#e94560", fontSize: "0.85rem" }}>
            {result.ok
              ? `✓ Puzzle created (ID: ${result.id}). Use "Set Active" to enable it.`
              : `Error: ${result.msg}`}
          </p>
        )}

        <button
          type="submit"
          disabled={isPending}
          style={{
            padding: "0.65rem 1.25rem",
            borderRadius: "var(--radius)",
            border: "none",
            background: isPending ? "var(--color-text-muted)" : "var(--color-card-selected)",
            color: "#fff",
            fontWeight: 600,
            fontSize: "0.95rem",
            cursor: isPending ? "not-allowed" : "pointer",
            alignSelf: "flex-start",
          }}
        >
          {isPending ? "Creating…" : "Create Puzzle"}
        </button>
      </form>
    </section>
  );
}
