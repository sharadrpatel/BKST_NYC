"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import WordCard from "./WordCard";
import SystemButton from "@/components/ui/SystemButton";
import { submitGuess } from "@/actions/game";

interface Word {
  id: string;
  text: string;
}

interface SolvedGroup {
  categoryId: string;
  title: string;
  colorTheme: string;
  wordIds: string[];
}

interface BoardProps {
  sessionId: string;
  words: Word[];
  initialSolvedGroups: SolvedGroup[];
  initialMistakes: number;
}

const MAX_MISTAKES = 4;

export default function Board({
  sessionId,
  words,
  initialSolvedGroups,
  initialMistakes,
}: BoardProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [solvedGroups, setSolvedGroups] = useState<SolvedGroup[]>(initialSolvedGroups);
  const [mistakes, setMistakes] = useState(initialMistakes);
  const [shakingIds, setShakingIds] = useState<string[]>([]);
  const [isAnimating, setIsAnimating] = useState(false); // true during shake (600ms)
  const [message, setMessage] = useState<string | null>(null);
  const [gameOver, setGameOver] = useState(false);

  const lockedWordIds = new Set(solvedGroups.flatMap((g) => g.wordIds));
  const remainingWords = words.filter((w) => !lockedWordIds.has(w.id));
  const mistakesLeft = MAX_MISTAKES - mistakes;

  // Blocks all interaction: server round-trip OR shake animation in progress
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
  // Submission
  // -------------------------------------------------------------------------

  function handleSubmit() {
    if (selectedIds.length !== 4 || blocked) return;
    setMessage(null);

    startTransition(async () => {
      const result = await submitGuess(sessionId, selectedIds);

      if (result.correct) {
        const newGroup: SolvedGroup = {
          categoryId: result.categoryId,
          title: result.categoryTitle,
          colorTheme: result.colorTheme,
          wordIds: result.wordIds,
        };
        setSolvedGroups((prev) => [...prev, newGroup]);
        setSelectedIds([]);

        if (result.gameOver && result.status === "WON") {
          setMessage(`You won! Score: ${result.score}`);
          setGameOver(true);
          setTimeout(() => router.push("/leaderboard"), 2200);
        } else {
          setMessage(`✓ ${result.categoryTitle}`);
          setTimeout(() => setMessage(null), 1800);
        }
      } else {
        setMistakes(result.mistakes);

        // Lock all interaction for the full shake duration
        setIsAnimating(true);
        setShakingIds([...selectedIds]);
        setTimeout(() => {
          setShakingIds([]);
          setSelectedIds([]);
          setIsAnimating(false);
        }, 600);

        if (result.gameOver && result.status === "LOST") {
          setMessage("No more guesses — better luck next time!");
          setGameOver(true);
          setTimeout(() => router.push("/leaderboard"), 2500);
        } else {
          const left = mistakesLeft - 1;
          setMessage(`Not quite — ${left} guess${left === 1 ? "" : "es"} left`);
          setTimeout(() => setMessage(null), 1800);
        }
      }
    });
  }

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------

  return (
    <div
      className="play-main"
      style={{ width: "100%", maxWidth: 560, display: "flex", flexDirection: "column", gap: "0.75rem" }}
    >
      {/* Solved groups — reveal animation on mount */}
      {solvedGroups.map((group) => (
        <div
          key={group.categoryId}
          className="group-reveal"
          style={{
            background: group.colorTheme,
            borderRadius: "var(--radius)",
            padding: "1rem",
            textAlign: "center",
            color: "#111",
            fontWeight: 700,
            fontSize: "1rem",
            letterSpacing: "0.05em",
            textTransform: "uppercase",
          }}
        >
          {group.title}
        </div>
      ))}

      {/* Active 4×4 word grid with staggered entrance */}
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

      {/* Mistake dots — key trick re-mounts filled dot to re-trigger pulse */}
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
