"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import WordCard from "./WordCard";
import SystemButton from "@/components/ui/SystemButton";
import { submitGuess } from "@/actions/game";
import { DIFFICULTY_POINTS } from "@/lib/math";

interface Word {
  id: string;
  text: string;
}

export interface DisplayGroup {
  categoryId: string;
  title: string;
  colorTheme: string;
  wordIds: string[];
  difficulty: number;
  /** true = player solved it correctly and earned points; false = revealed after a wrong guess */
  earned: boolean;
}

interface BoardProps {
  sessionId: string;
  words: Word[];
  initialDisplayGroups: DisplayGroup[];
  initialMistakes: number;
}

const MAX_MISTAKES = 4;

export default function Board({
  sessionId,
  words,
  initialDisplayGroups,
  initialMistakes,
}: BoardProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [displayGroups, setDisplayGroups] = useState<DisplayGroup[]>(initialDisplayGroups);
  const [mistakes, setMistakes] = useState(initialMistakes);
  const [shakingIds, setShakingIds] = useState<string[]>([]);
  const [isAnimating, setIsAnimating] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [gameOver, setGameOver] = useState(false);

  const lockedWordIds = new Set(displayGroups.flatMap((g) => g.wordIds));
  const remainingWords = words.filter((w) => !lockedWordIds.has(w.id));
  const mistakesLeft = MAX_MISTAKES - mistakes;

  const blocked = isPending || isAnimating || gameOver;

  // -------------------------------------------------------------------------
  // Selection
  // -------------------------------------------------------------------------

  function handleSelect(id: string) {
    if (blocked) return;
    setSelectedIds((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id);
      if (prev.length >= 4) return prev;
      return [...prev, id];
    });
  }

  function handleDeselectAll() {
    if (blocked) return;
    setSelectedIds([]);
  }

  // -------------------------------------------------------------------------
  // Helpers
  // -------------------------------------------------------------------------

  function toDisplayGroup(g: { categoryId: string; categoryTitle: string; colorTheme: string; wordIds: string[]; difficulty: number }, earned: boolean): DisplayGroup {
    return { categoryId: g.categoryId, title: g.categoryTitle, colorTheme: g.colorTheme, wordIds: g.wordIds, difficulty: g.difficulty, earned };
  }

  function triggerShake(ids: string[], onDone?: () => void) {
    setIsAnimating(true);
    setShakingIds(ids);
    setTimeout(() => {
      setShakingIds([]);
      setSelectedIds([]);
      setIsAnimating(false);
      onDone?.();
    }, 600);
  }

  // -------------------------------------------------------------------------
  // Submission
  // -------------------------------------------------------------------------

  function handleSubmit() {
    if (selectedIds.length !== 4 || blocked) return;
    setMessage(null);

    startTransition(async () => {
      const result = await submitGuess(sessionId, selectedIds);

      if (result.correct) {
        const newGroup = toDisplayGroup(
          { categoryId: result.categoryId, categoryTitle: result.categoryTitle, colorTheme: result.colorTheme, wordIds: result.wordIds, difficulty: result.difficulty },
          true
        );
        setDisplayGroups((prev) => [...prev, newGroup]);
        setSelectedIds([]);

        if (result.gameOver && result.status === "WON") {
          setMessage(`You won! Score: ${result.score}`);
          setGameOver(true);
          setTimeout(() => router.push("/leaderboard"), 2500);
        } else {
          const pts = DIFFICULTY_POINTS[result.difficulty] ?? 0;
          setMessage(`✓ ${result.categoryTitle} (+${pts} pts)`);
          setTimeout(() => setMessage(null), 2000);
        }
        return;
      }

      // Wrong guess — always shake first, then branch
      setMistakes(result.mistakes);
      const snapshotIds = [...selectedIds];

      if (result.gameOver) {
        // LOST — reveal all remaining groups at once
        triggerShake(snapshotIds, () => {
          if (result.revealedAll.length > 0) {
            setDisplayGroups((prev) => [
              ...prev,
              ...result.revealedAll.map((g) => toDisplayGroup(g, false)),
            ]);
          }
          const msg = result.score > 0
            ? `Game over! Score: ${result.score}`
            : "No more guesses — better luck next time!";
          setMessage(msg);
          setGameOver(true);
          setTimeout(() => router.push("/leaderboard"), 2500);
        });
        return;
      }

      // Wrong guess, game continues — no reveal
      triggerShake(snapshotIds, () => {
        const left = MAX_MISTAKES - result.mistakes;
        setMessage(`Not quite — ${left} guess${left === 1 ? "" : "es"} left`);
        setTimeout(() => setMessage(null), 2200);
      });
    });
  }

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------

  return (
    <div
      style={{ width: "100%", maxWidth: 560, display: "flex", flexDirection: "column", gap: "0.75rem" }}
    >
      {/* Solved / revealed group tiles */}
      {displayGroups.map((group) => (
        <div
          key={group.categoryId}
          className="group-reveal"
          style={{
            background: group.colorTheme,
            opacity: group.earned ? 1 : 0.55,
            borderRadius: "var(--radius)",
            border: group.earned ? "none" : "2px dashed rgba(0,0,0,0.35)",
            padding: "0.65rem 1rem",
            textAlign: "center",
            color: "#111",
            fontWeight: 700,
            fontSize: "0.95rem",
            letterSpacing: "0.05em",
            textTransform: "uppercase",
          }}
        >
          <div>{group.earned ? `✓ ${group.title}` : `↳ ${group.title}`}</div>
          <div
            style={{
              fontSize: "0.7rem",
              fontWeight: 500,
              marginTop: "0.15rem",
              opacity: 0.75,
              textTransform: "none",
              letterSpacing: 0,
            }}
          >
            {group.earned
              ? `+${DIFFICULTY_POINTS[group.difficulty] ?? 0} pts`
              : "not earned"}
          </div>
        </div>
      ))}

      {/* Active 4×4 word grid */}
      {remainingWords.length > 0 && (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(4, 1fr)",
            gap: "0.5rem",
          }}
        >
          {remainingWords.map((word, i) => (
            <div
              key={word.id}
              className="card-entrance"
              style={{ animationDelay: `${i * 35}ms` }}
            >
              <WordCard
                id={word.id}
                text={word.text}
                selected={selectedIds.includes(word.id)}
                shaking={shakingIds.includes(word.id)}
                onClick={handleSelect}
              />
            </div>
          ))}
        </div>
      )}

      {/* Status message */}
      {message && (
        <p
          className={gameOver ? "game-over-message" : undefined}
          style={{
            textAlign: "center",
            fontWeight: 600,
            color: "var(--color-text)",
            minHeight: "1.5rem",
          }}
        >
          {message}
        </p>
      )}

      {/* Mistake dots */}
      <div style={{ display: "flex", alignItems: "center", gap: "0.4rem", justifyContent: "center" }}>
        <span style={{ fontSize: "0.85rem", color: "var(--color-text-muted)", marginRight: "0.4rem" }}>
          Mistakes:
        </span>
        {Array.from({ length: MAX_MISTAKES }).map((_, i) => {
          const filled = i < mistakes;
          return (
            <span
              key={`dot-${i}-${filled ? "filled" : "empty"}`}
              className={`mistake-dot${filled ? " mistake-dot--filled" : ""}`}
            />
          );
        })}
      </div>

      {/* Controls */}
      {!gameOver && (
        <div style={{ display: "flex", gap: "0.75rem", justifyContent: "center" }}>
          <SystemButton
            variant="ghost"
            onClick={handleDeselectAll}
            disabled={selectedIds.length === 0 || blocked}
          >
            Deselect all
          </SystemButton>
          <SystemButton
            variant="primary"
            onClick={handleSubmit}
            disabled={selectedIds.length !== 4 || blocked}
          >
            {isPending ? "Checking…" : "Submit"}
          </SystemButton>
        </div>
      )}
    </div>
  );
}
