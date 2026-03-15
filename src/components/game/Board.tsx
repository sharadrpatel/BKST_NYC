"use client";

import {
  useState,
  useTransition,
  useRef,
  useLayoutEffect,
  useEffect,
  useMemo,
  useCallback,
} from "react";
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

interface SolvingState {
  group: DisplayGroup;
  wordIds: Set<string>;
  phase: "gather" | "merge";
}

const MAX_MISTAKES = 4;

const DIFFICULTY_LABEL: Record<number, string> = {
  1: "Straightforward",
  2: "Moderate",
  3: "Tricky",
  4: "Devious",
};

export default function Board({
  sessionId,
  words,
  initialDisplayGroups,
  initialMistakes,
}: BoardProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [displayGroups, setDisplayGroups] =
    useState<DisplayGroup[]>(initialDisplayGroups);
  const [mistakes, setMistakes] = useState(initialMistakes);
  const [shakingIds, setShakingIds] = useState<string[]>([]);
  const [isAnimating, setIsAnimating] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [gameOver, setGameOver] = useState(false);
  const [showHowToPlay, setShowHowToPlay] = useState(true);

  // Solve animation
  const [solvingState, setSolvingState] = useState<SolvingState | null>(null);
  const gridRef = useRef<HTMLDivElement>(null);
  const prevRectsRef = useRef<Map<string, DOMRect>>(new Map());
  const flipDoneRef = useRef(false);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const pendingResultRef = useRef<any>(null);
  const entranceDone = useRef(initialDisplayGroups.length > 0);

  const lockedWordIds = new Set(displayGroups.flatMap((g) => g.wordIds));
  const remainingWords = words.filter((w) => !lockedWordIds.has(w.id));

  const orderedWords = useMemo(() => {
    if (!solvingState) return remainingWords;
    const solving: Word[] = [];
    const rest: Word[] = [];
    for (const w of remainingWords) {
      (solvingState.wordIds.has(w.id) ? solving : rest).push(w);
    }
    return [...solving, ...rest];
  }, [remainingWords, solvingState]);

  const mistakesLeft = MAX_MISTAKES - mistakes;
  const blocked = isPending || isAnimating || gameOver;

  const snapshotPositions = useCallback(() => {
    const map = new Map<string, DOMRect>();
    if (!gridRef.current) return map;
    gridRef.current
      .querySelectorAll<HTMLElement>("[data-word-id]")
      .forEach((el) => {
        map.set(el.dataset.wordId!, el.getBoundingClientRect());
      });
    return map;
  }, []);

  // ── FLIP animation for gather phase ─────────────────────
  useLayoutEffect(() => {
    if (
      !solvingState ||
      solvingState.phase !== "gather" ||
      prevRectsRef.current.size === 0 ||
      flipDoneRef.current
    )
      return;

    const grid = gridRef.current;
    if (!grid) return;

    flipDoneRef.current = true;
    const cards = grid.querySelectorAll<HTMLElement>("[data-word-id]");
    const animations: Animation[] = [];

    cards.forEach((card) => {
      const id = card.dataset.wordId!;
      const prevRect = prevRectsRef.current.get(id);
      if (!prevRect) return;

      const newRect = card.getBoundingClientRect();
      const dx = prevRect.left - newRect.left;
      const dy = prevRect.top - newRect.top;

      if (Math.abs(dx) < 1 && Math.abs(dy) < 1) return;

      const isSolving = solvingState.wordIds.has(id);
      const keyframes = isSolving
        ? [
            {
              transform: `translate(${dx}px, ${dy}px) scale(1)`,
              zIndex: "10",
            },
            {
              transform: "translate(0, 0) scale(1.02)",
              zIndex: "10",
              offset: 0.7,
            },
            {
              transform: "translate(0, 0) scale(1)",
              zIndex: "10",
            },
          ]
        : [
            { transform: `translate(${dx}px, ${dy}px)`, zIndex: "1" },
            { transform: "translate(0, 0)", zIndex: "1" },
          ];

      const anim = card.animate(keyframes, {
        duration: 950,
        easing: "cubic-bezier(0.22, 1, 0.36, 1)",
        fill: "both",
      });
      animations.push(anim);
    });

    if (animations.length === 0) {
      setSolvingState((prev) =>
        prev ? { ...prev, phase: "merge" } : null,
      );
      return;
    }

    Promise.all(animations.map((a) => a.finished)).then(() => {
      animations.forEach((a) => a.cancel());
      setSolvingState((prev) =>
        prev ? { ...prev, phase: "merge" } : null,
      );
    });

    prevRectsRef.current = new Map();
  }, [solvingState]);

  // ── Merge phase — swap cards for group tile ─────────────
  useEffect(() => {
    if (!solvingState || solvingState.phase !== "merge") return;

    const timer = setTimeout(() => {
      const group = solvingState.group;
      setDisplayGroups((prev) => [...prev, group]);
      setSelectedIds([]);
      setSolvingState(null);
      setIsAnimating(false);
      flipDoneRef.current = false;

      const result = pendingResultRef.current;
      pendingResultRef.current = null;
      if (result) {
        if (result.gameOver && result.status === "WON") {
          setMessage(`You won! Score: ${result.score}`);
          setGameOver(true);
          setTimeout(() => router.push("/leaderboard"), 2500);
        } else {
          const pts = DIFFICULTY_POINTS[result.difficulty] ?? 0;
          setMessage(`\u2713 ${result.categoryTitle} (+${pts} pts)`);
          setTimeout(() => setMessage(null), 2000);
        }
      }
    }, 16);

    return () => clearTimeout(timer);
  }, [solvingState, router]);

  // ── Selection ───────────────────────────────────────────

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

  // ── Helpers ─────────────────────────────────────────────

  function toDisplayGroup(
    g: {
      categoryId: string;
      categoryTitle: string;
      colorTheme: string;
      wordIds: string[];
      difficulty: number;
    },
    earned: boolean,
  ): DisplayGroup {
    return {
      categoryId: g.categoryId,
      title: g.categoryTitle,
      colorTheme: g.colorTheme,
      wordIds: g.wordIds,
      difficulty: g.difficulty,
      earned,
    };
  }

  function triggerShake(ids: string[], onDone?: () => void) {
    setIsAnimating(true);
    setShakingIds(ids);
    setTimeout(() => {
      setShakingIds([]);
      setSelectedIds([]);
      setIsAnimating(false);
      onDone?.();
    }, 750);
  }

  // ── Submission ──────────────────────────────────────────

  function handleSubmit() {
    if (selectedIds.length !== 4 || blocked) return;
    setMessage(null);

    startTransition(async () => {
      const result = await submitGuess(sessionId, selectedIds);

      if (result.correct) {
        const newGroup = toDisplayGroup(
          {
            categoryId: result.categoryId,
            categoryTitle: result.categoryTitle,
            colorTheme: result.colorTheme,
            wordIds: result.wordIds,
            difficulty: result.difficulty,
          },
          true,
        );

<<<<<<< HEAD
        prevRectsRef.current = snapshotPositions();
        flipDoneRef.current = false;
        pendingResultRef.current = result;
        entranceDone.current = true;

        setIsAnimating(true);
        setSelectedIds([]);
        setSolvingState({
          group: newGroup,
          wordIds: new Set(result.wordIds),
          phase: "gather",
        });
=======
        if (result.gameOver && result.status === "WON") {
          setMessage(`You won! Score: ${result.score}`);
          setGameOver(true);
          setTimeout(() => router.push("/play/review"), 15000);
        } else {
          const pts = DIFFICULTY_POINTS[result.difficulty] ?? 0;
          setMessage(`✓ ${result.categoryTitle} (+${pts} pts)`);
          setTimeout(() => setMessage(null), 2000);
        }
>>>>>>> aa3f9c8 (change behavior of end screen)
        return;
      }

      // Wrong guess
      setMistakes(result.mistakes);
      const snapshotIds = [...selectedIds];

      if (result.gameOver) {
        triggerShake(snapshotIds, () => {
          if (result.revealedAll.length > 0) {
            setDisplayGroups((prev) => [
              ...prev,
              ...result.revealedAll.map((g) => toDisplayGroup(g, false)),
            ]);
          }
          const msg =
            result.score > 0
              ? `Game over \u2014 Score: ${result.score}`
              : "No more guesses \u2014 better luck next time!";
          setMessage(msg);
          setGameOver(true);
          setTimeout(() => router.push("/play/review"), 15000);
        });
        return;
      }

      triggerShake(snapshotIds, () => {
        const left = MAX_MISTAKES - result.mistakes;
        if (result.oneAway) {
          setMessage(
            `One away \u2014 ${left} guess${left === 1 ? "" : "es"} left`,
          );
        } else {
          setMessage(
            `Not quite \u2014 ${left} guess${left === 1 ? "" : "es"} left`,
          );
        }
        setTimeout(() => setMessage(null), 2200);
      });
    });
  }

  // ── Render ──────────────────────────────────────────────

  return (
    <div
      style={{
        width: "100%",
        maxWidth: 560,
        display: "flex",
        flexDirection: "column",
        gap: "0.625rem",
        containerType: "inline-size",
      }}
    >
      <div style={{ display: "flex", justifyContent: "flex-end" }}>
        <button
          type="button"
          onClick={() => setShowHowToPlay((prev) => !prev)}
          style={{
            border: "1px solid var(--color-border)",
            borderRadius: "999px",
            background: "var(--color-surface)",
            color: "var(--color-text)",
            fontSize: "0.75rem",
            fontWeight: 700,
            letterSpacing: "0.04em",
            textTransform: "uppercase",
            padding: "0.28rem 0.7rem",
            cursor: "pointer",
          }}
        >
          {showHowToPlay ? "Hide help" : "How to play"}
        </button>
      </div>

      {showHowToPlay && (
        <section
          style={{
            border: "1px solid var(--color-border)",
            borderRadius: "var(--radius)",
            background: "var(--color-surface)",
            boxShadow: "var(--shadow-sm)",
            padding: "1rem 1rem 0.9rem",
            display: "flex",
            flexDirection: "column",
            gap: "0.5rem",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "start",
              justifyContent: "space-between",
              gap: "0.5rem",
            }}
          >
            <h2
              style={{
                margin: 0,
                fontSize: "1.1rem",
                fontWeight: 800,
                color: "var(--color-text)",
              }}
            >
              How to Play
            </h2>
            <button
              type="button"
              onClick={() => setShowHowToPlay(false)}
              aria-label="Close how to play"
              style={{
                border: "none",
                background: "transparent",
                color: "var(--color-text-muted)",
                fontSize: "1.25rem",
                lineHeight: 1,
                cursor: "pointer",
                padding: 0,
              }}
            >
              ×
            </button>
          </div>

          <p
            style={{
              margin: 0,
              color: "var(--color-text)",
              fontSize: "0.92rem",
              lineHeight: 1.45,
            }}
          >
            Create four groups of four words that share something in common.
          </p>

          <ul
            style={{
              margin: "0.1rem 0 0.2rem 1.1rem",
              padding: 0,
              color: "var(--color-text)",
              lineHeight: 1.45,
            }}
          >
            <li>
              Select 4 words and press <strong>Submit</strong>.
            </li>
            <li>If you miss 4 times, the game ends.</li>
            <li>
              If you get 3 out of 4, you will see <strong>One away</strong>.
            </li>
          </ul>

          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "0.35rem",
            }}
          >
            <span
              style={{
                fontWeight: 700,
                fontSize: "0.83rem",
                color: "var(--color-text)",
              }}
            >
              Difficulty colors
            </span>
            <div
              style={{ display: "flex", flexWrap: "wrap", gap: "0.45rem" }}
            >
              {[
                { label: "Straightforward", color: "#f2d763" },
                { label: "Moderate", color: "#8bbf50" },
                { label: "Tricky", color: "#8ea7d9" },
                { label: "Devious", color: "#a171be" },
              ].map((item) => (
                <span
                  key={item.label}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "0.35rem",
                    border: "1px solid var(--color-border)",
                    borderRadius: "999px",
                    padding: "0.2rem 0.55rem 0.2rem 0.3rem",
                    fontSize: "0.76rem",
                    color: "var(--color-text-muted)",
                    background: "rgba(255,255,255,0.4)",
                  }}
                >
                  <span
                    style={{
                      width: "0.72rem",
                      height: "0.72rem",
                      borderRadius: "999px",
                      background: item.color,
                    }}
                  />
                  {item.label}
                </span>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Solved / revealed group tiles */}
      {displayGroups.map((group) => (
        <div
          key={group.categoryId}
          className="group-reveal"
          style={{
            background: group.earned ? group.colorTheme : "transparent",
            borderRadius: "var(--radius)",
            border: group.earned
              ? "2px solid transparent"
              : "2px dashed rgba(0,0,0,0.2)",
            padding: "0 1.25rem",
            height: "calc((100cqi - 1.5rem) / 4)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            color: "#111",
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
                color: group.earned
                  ? "rgba(0,0,0,0.55)"
                  : "var(--color-text-muted)",
              }}
            >
              {DIFFICULTY_LABEL[group.difficulty] ??
                `Difficulty ${group.difficulty}`}
            </div>
          </div>
          <div style={{ textAlign: "right", flexShrink: 0 }}>
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
      ))}

      {/* Active 4x4 word grid */}
      {orderedWords.length > 0 && (
        <div
          ref={gridRef}
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(4, 1fr)",
            gap: "0.5rem",
          }}
        >
          {orderedWords.map((word, i) => {
            const isSolving = solvingState?.wordIds.has(word.id) ?? false;

            return (
              <div
                key={word.id}
                data-word-id={word.id}
                className={
                  !entranceDone.current ? "card-entrance" : undefined
                }
                style={{
                  animationDelay: !entranceDone.current
                    ? `${i * 50}ms`
                    : undefined,
                  position: "relative",
                }}
              >
                <WordCard
                  id={word.id}
                  text={word.text}
                  selected={selectedIds.includes(word.id) || isSolving}
                  shaking={shakingIds.includes(word.id)}
                  onClick={handleSelect}
                />
              </div>
            );
          })}
        </div>
      )}

      {/* Status message */}
      {message && (
        <p
          className={gameOver ? "game-over-message" : undefined}
          style={{
            textAlign: "center",
            fontWeight: 600,
            fontSize: "0.925rem",
            color: "var(--color-text)",
            minHeight: "1.5rem",
            animation: "fade-in 0.25s ease both",
          }}
        >
          {message}
        </p>
      )}

      {/* Mistake tracker */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "0.5rem",
          justifyContent: "center",
          padding: "0.25rem 0",
        }}
      >
        <span
          style={{
            fontSize: "0.8rem",
            fontWeight: 500,
            color: "var(--color-text-muted)",
            letterSpacing: "0.02em",
          }}
        >
          {mistakesLeft > 0
            ? `${mistakesLeft} guess${mistakesLeft === 1 ? "" : "es"} remaining`
            : "No guesses left"}
        </span>
        <div style={{ display: "flex", gap: "0.3rem" }}>
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
      </div>

      {/* Controls */}
      {gameOver ? (
        <div
          style={{
            display: "flex",
            gap: "0.6rem",
            justifyContent: "center",
            paddingTop: "0.25rem",
          }}
        >
          <SystemButton variant="ghost" onClick={() => router.push("/play/review")}>
            Review answers
          </SystemButton>
          <SystemButton variant="primary" onClick={() => router.push("/leaderboard")}>
            View leaderboard
          </SystemButton>
        </div>
      ) : (
        <div
          style={{
            display: "flex",
            gap: "0.6rem",
            justifyContent: "center",
            paddingTop: "0.25rem",
          }}
        >
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
            {isPending
              ? "Checking\u2026"
              : `Submit${selectedIds.length === 4 ? "" : ` (${selectedIds.length}/4)`}`}
          </SystemButton>
        </div>
      )}
    </div>
  );
}
