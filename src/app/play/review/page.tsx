// Post-game review page — Server Component.
// Shows completed puzzle (all groups earned + revealed) with final score.
// Accessible any time after game completion via session cookie.

export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { eq, inArray } from "drizzle-orm";
import Link from "next/link";
import { db } from "@/db";
import { gameSessions, categories, words } from "@/db/schema";
import { getSessionId } from "@/lib/session";
import { DIFFICULTY_POINTS } from "@/lib/math";

const DIFFICULTY_LABEL: Record<number, string> = {
  1: "Straightforward",
  2: "Moderate",
  3: "Tricky",
  4: "Devious",
};

interface DisplayGroup {
  categoryId: string;
  title: string;
  colorTheme: string;
  difficulty: number;
  wordTexts: string[];
  earned: boolean;
}

export default async function ReviewPage() {
  const sessionId = await getSessionId();
  if (!sessionId) redirect("/");

  const [session] = await db
    .select()
    .from(gameSessions)
    .where(eq(gameSessions.id, sessionId))
    .limit(1);

  if (!session) redirect("/");
  if (session.status === "IN_PROGRESS") redirect("/play");

  const solvedIds = JSON.parse(session.solved_groups) as string[];
  const revealedIds = JSON.parse(session.revealed_groups) as string[];
  const allLockedIds = [...solvedIds, ...revealedIds];

  let displayGroups: DisplayGroup[] = [];

  if (allLockedIds.length > 0) {
    const [lockedCats, allWords] = await Promise.all([
      db.select().from(categories).where(inArray(categories.id, allLockedIds)),
      db
        .select({ id: words.id, text: words.text, categoryId: words.category_id })
        .from(words)
        .where(inArray(words.category_id, allLockedIds)),
    ]);

    const catById = new Map(lockedCats.map((c) => [c.id, c]));
    const wordsByCat = new Map<string, string[]>();
    for (const w of allWords) {
      const arr = wordsByCat.get(w.categoryId) ?? [];
      arr.push(w.text);
      wordsByCat.set(w.categoryId, arr);
    }

    displayGroups = allLockedIds
      .map((id) => {
        const cat = catById.get(id);
        if (!cat) return null;
        return {
          categoryId: cat.id,
          title: cat.title,
          colorTheme: cat.color_theme,
          difficulty: cat.difficulty,
          wordTexts: wordsByCat.get(id) ?? [],
          earned: solvedIds.includes(id),
        };
      })
      .filter(Boolean) as DisplayGroup[];
  }

  const status = session.status as "WON" | "LOST";
  const score = session.score ?? 0;

  const headlineText = status === "WON" ? "You solved it!" : "Game over";
  const headlineColor = status === "WON" ? "var(--color-success)" : "var(--color-error)";

  return (
    <main
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        minHeight: "100vh",
        background: "var(--color-bg)",
      }}
    >
      {/* Top nav */}
      <header
        style={{
          width: "100%",
          borderBottom: "1px solid var(--color-border)",
          background: "var(--color-surface)",
          padding: "0.875rem 1.5rem",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          boxShadow: "var(--shadow-xs)",
        }}
      >
        <h1
          style={{
            fontSize: "1.15rem",
            fontWeight: 800,
            letterSpacing: "-0.03em",
            color: "var(--color-text)",
          }}
        >
          The Akshar Times
        </h1>
      </header>

      <div
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          padding: "2rem 1rem 3rem",
          width: "100%",
          maxWidth: 560,
          gap: "1rem",
        }}
      >
        {/* Result banner */}
        <div
          style={{
            width: "100%",
            background: "var(--color-surface)",
            border: "1px solid var(--color-border)",
            borderRadius: "var(--radius-md)",
            boxShadow: "var(--shadow-sm)",
            padding: "1.25rem 1.5rem",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: "1rem",
          }}
        >
          <div>
            <div
              style={{
                fontSize: "1.15rem",
                fontWeight: 800,
                color: headlineColor,
                letterSpacing: "-0.02em",
              }}
            >
              {headlineText}
            </div>
            <div
              style={{
                fontSize: "0.85rem",
                color: "var(--color-text-muted)",
                marginTop: "0.2rem",
              }}
            >
              {session.mistakes} mistake{session.mistakes !== 1 ? "s" : ""}
            </div>
          </div>
          <div
            style={{
              textAlign: "right",
              flexShrink: 0,
            }}
          >
            <div
              style={{
                fontSize: "2rem",
                fontWeight: 800,
                letterSpacing: "-0.04em",
                color: "var(--color-text)",
                lineHeight: 1,
              }}
            >
              {score}
            </div>
            <div
              style={{
                fontSize: "0.72rem",
                fontWeight: 600,
                color: "var(--color-text-muted)",
                textTransform: "uppercase",
                letterSpacing: "0.06em",
                marginTop: "0.15rem",
              }}
            >
              points
            </div>
          </div>
        </div>

        {/* Group tiles */}
        <div
          style={{
            width: "100%",
            display: "flex",
            flexDirection: "column",
            gap: "0.625rem",
          }}
        >
          {displayGroups.map((group) => (
            <div
              key={group.categoryId}
              style={{
                background: group.earned ? group.colorTheme : "transparent",
                borderRadius: "var(--radius)",
                border: group.earned
                  ? "2px solid transparent"
                  : "2px dashed rgba(0,0,0,0.2)",
                padding: "0.75rem 1.25rem",
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  marginBottom: "0.45rem",
                }}
              >
                <div>
                  <div
                    style={{
                      fontWeight: 700,
                      fontSize: "0.9rem",
                      letterSpacing: "0.04em",
                      textTransform: "uppercase",
                      color: group.earned ? "#111" : "var(--color-text-muted)",
                    }}
                  >
                    {group.title}
                  </div>
                  <div
                    style={{
                      fontSize: "0.72rem",
                      fontWeight: 500,
                      marginTop: "0.1rem",
                      color: group.earned ? "rgba(0,0,0,0.55)" : "var(--color-text-muted)",
                    }}
                  >
                    {DIFFICULTY_LABEL[group.difficulty] ?? `Difficulty ${group.difficulty}`}
                  </div>
                </div>
                <div style={{ flexShrink: 0 }}>
                  {group.earned ? (
                    <span
                      style={{
                        fontSize: "0.78rem",
                        fontWeight: 700,
                        background: "rgba(0,0,0,0.12)",
                        padding: "0.2rem 0.55rem",
                        borderRadius: "var(--radius-sm)",
                        color: "#111",
                      }}
                    >
                      +{DIFFICULTY_POINTS[group.difficulty] ?? 0} pts
                    </span>
                  ) : (
                    <span
                      style={{
                        fontSize: "0.72rem",
                        fontWeight: 600,
                        color: "var(--color-text-muted)",
                        letterSpacing: "0.03em",
                      }}
                    >
                      not earned
                    </span>
                  )}
                </div>
              </div>

              {/* Word list */}
              {group.wordTexts.length > 0 && (
                <div
                  style={{
                    display: "flex",
                    flexWrap: "wrap",
                    gap: "0.3rem",
                  }}
                >
                  {group.wordTexts.map((text) => (
                    <span
                      key={text}
                      style={{
                        fontSize: "0.78rem",
                        fontWeight: 500,
                        background: group.earned
                          ? "rgba(0,0,0,0.12)"
                          : "rgba(0,0,0,0.06)",
                        color: group.earned ? "#111" : "var(--color-text-muted)",
                        borderRadius: "var(--radius-sm)",
                        padding: "0.15rem 0.45rem",
                      }}
                    >
                      {text}
                    </span>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Action buttons */}
        <div
          style={{
            display: "flex",
            gap: "0.75rem",
            justifyContent: "center",
            paddingTop: "0.5rem",
            width: "100%",
          }}
        >
          <Link
            href="/leaderboard"
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              background: "var(--color-text)",
              color: "var(--color-bg)",
              fontWeight: 700,
              fontSize: "0.9rem",
              padding: "0.6rem 1.5rem",
              borderRadius: "var(--radius)",
              textDecoration: "none",
              letterSpacing: "0.01em",
            }}
          >
            View Leaderboard
          </Link>
        </div>
      </div>
    </main>
  );
}
