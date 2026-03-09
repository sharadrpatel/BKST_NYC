"use client";

import { Fragment, useState, useTransition, useMemo, useEffect } from "react";
import { useRouter } from "next/navigation";
import { updatePlayer, deletePlayer } from "@/actions/admin";

export interface PlayerRow {
  id: string;
  display_name: string;
  access_code: string;
  mode: "scored" | "test";
  sessionCount: number;
  hasActiveSession: boolean;
}

interface Props {
  initialPlayers: PlayerRow[];
}

const inputStyle: React.CSSProperties = {
  padding: "0.3rem 0.5rem",
  borderRadius: "var(--radius)",
  border: "1px solid var(--color-border)",
  background: "var(--color-bg)",
  color: "var(--color-text)",
  fontSize: "0.875rem",
  width: "100%",
  minWidth: 80,
};

function btnStyle(color?: string): React.CSSProperties {
  return {
    padding: "0.3rem 0.65rem",
    borderRadius: "var(--radius)",
    border: `1px solid ${color ?? "var(--color-border)"}`,
    background: "transparent",
    color: color ?? "var(--color-text-muted)",
    fontSize: "0.8rem",
    cursor: "pointer",
    fontWeight: 500,
    whiteSpace: "nowrap" as const,
  };
}

export default function PlayerManager({ initialPlayers }: Props) {
  const router = useRouter();
  const [players, setPlayers] = useState<PlayerRow[]>(initialPlayers);
  const [search, setSearch] = useState("");
  const [modeFilter, setModeFilter] = useState<"all" | "scored" | "test">("all");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({
    displayName: "",
    accessCode: "",
    mode: "scored" as "scored" | "test",
  });
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [messages, setMessages] = useState<
    Record<string, { type: "success" | "error"; text: string }>
  >({});
  const [isPending, startTransition] = useTransition();

  // Sync local state when server refreshes props
  useEffect(() => {
    setPlayers(initialPlayers);
  }, [initialPlayers]);

  const totalScored = players.filter((p) => p.mode === "scored").length;
  const totalTest = players.filter((p) => p.mode === "test").length;

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return players.filter((p) => {
      const matchesSearch =
        !q ||
        p.display_name.toLowerCase().includes(q) ||
        p.access_code.toLowerCase().includes(q);
      const matchesMode = modeFilter === "all" || p.mode === modeFilter;
      return matchesSearch && matchesMode;
    });
  }, [players, search, modeFilter]);

  function startEdit(p: PlayerRow) {
    setEditingId(p.id);
    setEditForm({ displayName: p.display_name, accessCode: p.access_code, mode: p.mode });
    setConfirmDeleteId(null);
    clearMessage(p.id);
  }

  function cancelEdit() {
    setEditingId(null);
  }

  function clearMessage(id: string) {
    setMessages((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
  }

  function setMessage(id: string, type: "success" | "error", text: string) {
    setMessages((prev) => ({ ...prev, [id]: { type, text } }));
    if (type === "success") {
      setTimeout(() => clearMessage(id), 3000);
    }
  }

  function handleSave(id: string) {
    startTransition(async () => {
      const result = await updatePlayer(id, editForm);
      if (result.error) {
        setMessage(id, "error", result.error);
      } else {
        setPlayers((prev) =>
          prev.map((p) =>
            p.id === id
              ? {
                  ...p,
                  display_name: editForm.displayName.trim(),
                  access_code: editForm.accessCode.trim().toUpperCase(),
                  mode: editForm.mode,
                }
              : p
          )
        );
        setEditingId(null);
        setMessage(id, "success", "Saved.");
        router.refresh();
      }
    });
  }

  function handleDeleteConfirm(id: string) {
    startTransition(async () => {
      const result = await deletePlayer(id);
      if (result.error) {
        setConfirmDeleteId(null);
        setMessage(id, "error", result.error);
      } else {
        setPlayers((prev) => prev.filter((p) => p.id !== id));
        setConfirmDeleteId(null);
        router.refresh();
      }
    });
  }

  const thStyle: React.CSSProperties = {
    padding: "0.5rem 0.75rem",
    fontWeight: 600,
    color: "var(--color-text-muted)",
    fontSize: "0.75rem",
    textTransform: "uppercase",
    letterSpacing: "0.04em",
    whiteSpace: "nowrap",
    textAlign: "left",
  };

  const tdStyle: React.CSSProperties = {
    padding: "0.5rem 0.75rem",
    verticalAlign: "middle",
  };

  return (
    <section style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
      <h2 style={{ fontSize: "1.1rem", fontWeight: 700 }}>
        Players{" "}
        <span style={{ fontWeight: 400, color: "var(--color-text-muted)", fontSize: "0.85rem" }}>
          ({players.length} total · {totalScored} scored · {totalTest} test)
        </span>
      </h2>

      {/* Search / filter */}
      <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
        <input
          type="text"
          placeholder="Search by name or BKID…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{
            flex: "1 1 220px",
            padding: "0.45rem 0.75rem",
            borderRadius: "var(--radius)",
            border: "1px solid var(--color-border)",
            background: "var(--color-surface)",
            color: "var(--color-text)",
            fontSize: "0.875rem",
          }}
        />
        <select
          value={modeFilter}
          onChange={(e) => setModeFilter(e.target.value as "all" | "scored" | "test")}
          style={{
            padding: "0.45rem 0.75rem",
            borderRadius: "var(--radius)",
            border: "1px solid var(--color-border)",
            background: "var(--color-surface)",
            color: "var(--color-text)",
            fontSize: "0.875rem",
          }}
        >
          <option value="all">All modes</option>
          <option value="scored">Scored only</option>
          <option value="test">Test only</option>
        </select>
      </div>

      {filtered.length === 0 ? (
        <p style={{ color: "var(--color-text-muted)", fontSize: "0.875rem" }}>
          {players.length === 0 ? "No players in the system yet." : "No players match your search."}
        </p>
      ) : (
        <div style={{ overflowX: "auto" }}>
          <table
            style={{
              width: "100%",
              borderCollapse: "collapse",
              fontSize: "0.875rem",
              borderRadius: "var(--radius)",
              overflow: "hidden",
              border: "1px solid var(--color-border)",
            }}
          >
            <thead>
              <tr style={{ borderBottom: "1px solid var(--color-border)", background: "var(--color-surface)" }}>
                <th style={thStyle}>Display Name</th>
                <th style={thStyle}>BKID</th>
                <th style={thStyle}>Mode</th>
                <th style={{ ...thStyle, textAlign: "center" }}>Sessions</th>
                <th style={{ ...thStyle, textAlign: "center" }}>Active?</th>
                <th style={thStyle}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((p) => {
                const isEditing = editingId === p.id;
                const isConfirmDelete = confirmDeleteId === p.id;
                const msg = messages[p.id];

                return (
                  <Fragment key={p.id}>
                    <tr
                      style={{
                        borderBottom: msg || isConfirmDelete ? "none" : "1px solid var(--color-border)",
                        background: isEditing ? "var(--color-surface)" : "transparent",
                        opacity: isPending && (isEditing || isConfirmDelete) ? 0.6 : 1,
                      }}
                    >
                      <td style={tdStyle}>
                        {isEditing ? (
                          <input
                            value={editForm.displayName}
                            onChange={(e) =>
                              setEditForm((f) => ({ ...f, displayName: e.target.value }))
                            }
                            style={inputStyle}
                          />
                        ) : (
                          p.display_name
                        )}
                      </td>
                      <td style={{ ...tdStyle, fontFamily: "monospace" }}>
                        {isEditing ? (
                          <input
                            value={editForm.accessCode}
                            onChange={(e) =>
                              setEditForm((f) => ({
                                ...f,
                                accessCode: e.target.value.toUpperCase(),
                              }))
                            }
                            style={inputStyle}
                          />
                        ) : (
                          p.access_code
                        )}
                      </td>
                      <td style={tdStyle}>
                        {isEditing ? (
                          <select
                            value={editForm.mode}
                            onChange={(e) =>
                              setEditForm((f) => ({
                                ...f,
                                mode: e.target.value as "scored" | "test",
                              }))
                            }
                            style={inputStyle}
                          >
                            <option value="scored">scored</option>
                            <option value="test">test</option>
                          </select>
                        ) : (
                          <span
                            style={{
                              color:
                                p.mode === "test" ? "var(--color-text-muted)" : "inherit",
                            }}
                          >
                            {p.mode}
                          </span>
                        )}
                      </td>
                      <td style={{ ...tdStyle, textAlign: "center" }}>{p.sessionCount}</td>
                      <td
                        style={{
                          ...tdStyle,
                          textAlign: "center",
                          color: p.hasActiveSession ? "#A0C35A" : "var(--color-text-muted)",
                        }}
                      >
                        {p.hasActiveSession ? "✓" : "–"}
                      </td>
                      <td style={tdStyle}>
                        {isEditing ? (
                          <span style={{ display: "flex", gap: "0.4rem" }}>
                            <button
                              onClick={() => handleSave(p.id)}
                              disabled={isPending}
                              style={btnStyle("#A0C35A")}
                            >
                              Save
                            </button>
                            <button onClick={cancelEdit} style={btnStyle()}>
                              Cancel
                            </button>
                          </span>
                        ) : isConfirmDelete ? null : (
                          <span style={{ display: "flex", gap: "0.4rem" }}>
                            <button onClick={() => startEdit(p)} style={btnStyle()}>
                              Edit
                            </button>
                            <button
                              onClick={() => {
                                setConfirmDeleteId(p.id);
                                setEditingId(null);
                              }}
                              style={btnStyle("#e94560")}
                            >
                              Delete
                            </button>
                          </span>
                        )}
                      </td>
                    </tr>

                    {/* Delete confirmation row */}
                    {isConfirmDelete && (
                      <tr
                        style={{
                          borderBottom: msg ? "none" : "1px solid var(--color-border)",
                          background: "rgba(233,69,96,0.08)",
                        }}
                      >
                        <td
                          colSpan={6}
                          style={{ padding: "0.6rem 0.75rem", fontSize: "0.875rem" }}
                        >
                          <span style={{ marginRight: "1rem" }}>
                            Delete <strong>{p.display_name}</strong>?{" "}
                            {p.sessionCount > 0 ? (
                              <>
                                This will also permanently delete{" "}
                                <strong>
                                  {p.sessionCount} session
                                  {p.sessionCount !== 1 ? "s" : ""}
                                </strong>
                                .
                              </>
                            ) : (
                              <>This player has no sessions.</>
                            )}
                          </span>
                          <button
                            onClick={() => handleDeleteConfirm(p.id)}
                            disabled={isPending}
                            style={btnStyle("#e94560")}
                          >
                            Confirm Delete
                          </button>{" "}
                          <button
                            onClick={() => setConfirmDeleteId(null)}
                            style={btnStyle()}
                          >
                            Cancel
                          </button>
                        </td>
                      </tr>
                    )}

                    {/* Success / error message row */}
                    {msg && (
                      <tr style={{ borderBottom: "1px solid var(--color-border)" }}>
                        <td
                          colSpan={6}
                          style={{
                            padding: "0.35rem 0.75rem",
                            fontSize: "0.8rem",
                            color: msg.type === "error" ? "#e94560" : "#A0C35A",
                          }}
                        >
                          {msg.text}
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
