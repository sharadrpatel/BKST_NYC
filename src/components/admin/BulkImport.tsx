"use client";

import { useState, useTransition } from "react";
import { importPlayers } from "@/actions/admin";
import type { ImportResult } from "@/actions/admin";

const PLACEHOLDER = `6824,Sharad Patel,scored
3856,Hari-Krishna Patel,scored
MAHANT_1933,Admin,test`;

export default function BulkImport() {
  const [isPending, startTransition] = useTransition();
  const [csv, setCsv] = useState("");
  const [result, setResult] = useState<ImportResult | null>(null);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setResult(null);
    startTransition(async () => {
      const res = await importPlayers(csv);
      setResult(res);
      if (res.inserted > 0) setCsv("");
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
      <h3 style={{ fontSize: "0.95rem", fontWeight: 700 }}>Bulk Import Players</h3>

      <p style={{ fontSize: "0.78rem", color: "var(--color-text-muted)", margin: 0 }}>
        One player per line:{" "}
        <code
          style={{
            background: "rgba(255,255,255,0.07)",
            padding: "0.1rem 0.3rem",
            borderRadius: 3,
            fontSize: "0.78rem",
          }}
        >
          BKID, Display Name, Mode
        </code>
        . Mode is <code style={{ fontSize: "0.78rem" }}>scored</code> or{" "}
        <code style={{ fontSize: "0.78rem" }}>test</code> (defaults to scored).
        Duplicate BKIDs are skipped.
      </p>

      <form
        onSubmit={handleSubmit}
        style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}
      >
        <textarea
          value={csv}
          onChange={(e) => setCsv(e.target.value)}
          placeholder={PLACEHOLDER}
          rows={6}
          required
          style={{
            padding: "0.5rem 0.75rem",
            borderRadius: "var(--radius)",
            border: "1px solid var(--color-border)",
            background: "var(--color-surface)",
            color: "var(--color-text)",
            fontSize: "0.82rem",
            fontFamily: "monospace",
            resize: "vertical",
            width: "100%",
            boxSizing: "border-box",
          }}
        />

        {result && (
          <div style={{ display: "flex", flexDirection: "column", gap: "0.3rem" }}>
            <p
              style={{
                fontSize: "0.85rem",
                color: result.inserted > 0 ? "#A0C35A" : "var(--color-text-muted)",
                margin: 0,
              }}
            >
              {result.inserted > 0
                ? `✓ Inserted ${result.inserted} player${result.inserted !== 1 ? "s" : ""}`
                : "No new players inserted."}
              {result.skipped > 0 && (
                <span style={{ color: "var(--color-text-muted)", marginLeft: "0.5rem" }}>
                  ({result.skipped} skipped — already exist)
                </span>
              )}
            </p>
            {result.errors.length > 0 && (
              <ul
                style={{
                  margin: 0,
                  paddingLeft: "1.1rem",
                  display: "flex",
                  flexDirection: "column",
                  gap: "0.15rem",
                }}
              >
                {result.errors.map((e, i) => (
                  <li key={i} style={{ fontSize: "0.78rem", color: "#e94560" }}>
                    {e}
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        <button
          type="submit"
          disabled={isPending || csv.trim().length === 0}
          style={{
            padding: "0.5rem 1rem",
            borderRadius: "var(--radius)",
            border: "none",
            background:
              isPending || csv.trim().length === 0
                ? "var(--color-text-muted)"
                : "var(--color-card-selected)",
            color: "#fff",
            fontWeight: 600,
            fontSize: "0.875rem",
            cursor: isPending || csv.trim().length === 0 ? "not-allowed" : "pointer",
            alignSelf: "flex-start",
          }}
        >
          {isPending ? "Importing…" : "Import Players"}
        </button>
      </form>
    </div>
  );
}
