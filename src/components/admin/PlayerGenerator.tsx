"use client";

import { useState, useTransition } from "react";
import { generatePlayers } from "@/actions/admin";

const inputStyle: React.CSSProperties = {
  padding: "0.5rem 0.75rem",
  borderRadius: "var(--radius)",
  border: "1px solid var(--color-border)",
  background: "var(--color-surface)",
  color: "var(--color-text)",
  fontSize: "0.875rem",
};

export default function PlayerGenerator() {
  const [isPending, startTransition] = useTransition();
  const [prefix, setPrefix] = useState("AKT");
  const [count, setCount] = useState(10);
  const [codes, setCodes] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setCodes([]);

    startTransition(async () => {
      try {
        const res = await generatePlayers(count, prefix);
        setCodes(res.codes);
      } catch (err) {
        setError((err as Error).message);
      }
    });
  }

  return (
    <section style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
      <h2 style={{ fontSize: "1.1rem", fontWeight: 700 }}>Generate Players</h2>

      <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
        <div style={{ display: "flex", gap: "0.75rem", alignItems: "flex-end", flexWrap: "wrap" }}>
          <div>
            <label style={{ display: "block", fontSize: "0.8rem", color: "var(--color-text-muted)", marginBottom: "0.3rem" }}>
              Code Prefix
            </label>
            <input
              style={{ ...inputStyle, width: 130 }}
              value={prefix}
              onChange={(e) => setPrefix(e.target.value.toUpperCase())}
              placeholder="AKT"
              maxLength={12}
              required
            />
          </div>

          <div>
            <label style={{ display: "block", fontSize: "0.8rem", color: "var(--color-text-muted)", marginBottom: "0.3rem" }}>
              Count
            </label>
            <input
              style={{ ...inputStyle, width: 90 }}
              type="number"
              min={1}
              max={200}
              value={count}
              onChange={(e) => setCount(Number(e.target.value))}
              required
            />
          </div>

          <button
            type="submit"
            disabled={isPending}
            style={{
              padding: "0.5rem 1.1rem",
              borderRadius: "var(--radius)",
              border: "none",
              background: isPending ? "var(--color-text-muted)" : "var(--color-card-selected)",
              color: "#fff",
              fontWeight: 600,
              fontSize: "0.9rem",
              cursor: isPending ? "not-allowed" : "pointer",
            }}
          >
            {isPending ? "Generating…" : "Generate"}
          </button>
        </div>

        <p style={{ fontSize: "0.8rem", color: "var(--color-text-muted)" }}>
          Codes follow the pattern <code>{prefix || "PREFIX"}-XXX</code>. display_name = access code.
        </p>
      </form>

      {error && (
        <p style={{ color: "#e94560", fontSize: "0.85rem" }}>Error: {error}</p>
      )}

      {codes.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
          <p style={{ fontSize: "0.85rem", color: "#A0C35A" }}>
            ✓ {codes.length} player{codes.length !== 1 ? "s" : ""} created — distribute these codes:
          </p>
          <textarea
            readOnly
            value={codes.join("\n")}
            rows={Math.min(codes.length, 12)}
            onClick={(e) => (e.target as HTMLTextAreaElement).select()}
            style={{
              ...inputStyle,
              width: "100%",
              fontFamily: "monospace",
              fontSize: "0.85rem",
              resize: "vertical",
              lineHeight: 1.6,
            }}
          />
        </div>
      )}
    </section>
  );
}
