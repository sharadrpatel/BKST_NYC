"use client";

import { useState, useTransition } from "react";
import { createPlayer } from "@/actions/admin";

const inputStyle: React.CSSProperties = {
  padding: "0.5rem 0.75rem",
  borderRadius: "var(--radius)",
  border: "1px solid var(--color-border)",
  background: "var(--color-surface)",
  color: "var(--color-text)",
  fontSize: "0.875rem",
  width: "100%",
};

export default function PlayerCreator() {
  const [isPending, startTransition] = useTransition();
  const [displayName, setDisplayName] = useState("");
  const [accessCode, setAccessCode] = useState("");
  const [mode, setMode] = useState<"scored" | "test">("scored");
  const [result, setResult] = useState<
    { ok: true; code: string } | { ok: false; msg: string } | null
  >(null);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setResult(null);
    startTransition(async () => {
      try {
        await createPlayer({ displayName, accessCode, mode });
        setResult({ ok: true, code: accessCode.trim().toUpperCase() });
        setDisplayName("");
        setAccessCode("");
        setMode("scored");
      } catch (err) {
        setResult({ ok: false, msg: (err as Error).message });
      }
    });
  }

  return (
    <div
      style={{
        background: "var(--color-surface)",
        border: "1px solid var(--color-border)",
        borderRadius: "var(--radius)",
        padding: "1.25rem",
      }}
    >
      <h3 style={{ fontSize: "0.95rem", fontWeight: 700, marginBottom: "1rem" }}>
        Create Player
      </h3>

      <form
        onSubmit={handleSubmit}
        style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}
      >
        <div>
          <label
            style={{
              display: "block",
              fontSize: "0.75rem",
              color: "var(--color-text-muted)",
              marginBottom: "0.25rem",
            }}
          >
            Display Name
          </label>
          <input
            style={inputStyle}
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder="e.g. John Doe"
            required
          />
        </div>

        <div>
          <label
            style={{
              display: "block",
              fontSize: "0.75rem",
              color: "var(--color-text-muted)",
              marginBottom: "0.25rem",
            }}
          >
            BKID
          </label>
          <input
            style={{ ...inputStyle, textTransform: "uppercase", letterSpacing: "0.05em" }}
            value={accessCode}
            onChange={(e) => setAccessCode(e.target.value)}
            placeholder="e.g. SMITH_1234"
            required
          />
        </div>

        <div>
          <label
            style={{
              display: "block",
              fontSize: "0.75rem",
              color: "var(--color-text-muted)",
              marginBottom: "0.25rem",
            }}
          >
            Mode
          </label>
          <select
            style={{ ...inputStyle, cursor: "pointer" }}
            value={mode}
            onChange={(e) => setMode(e.target.value as "scored" | "test")}
          >
            <option value="scored">Scored</option>
            <option value="test">Test (unlimited replay)</option>
          </select>
        </div>

        {result && (
          <p style={{ color: result.ok ? "#A0C35A" : "#e94560", fontSize: "0.85rem" }}>
            {result.ok ? `✓ Created ${result.code}` : `Error: ${result.msg}`}
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
          {isPending ? "Creating…" : "Create Player"}
        </button>
      </form>
    </div>
  );
}
