"use client";

interface WordCardProps {
  id: string;
  text: string;
  selected: boolean;
  shaking: boolean;
  merging?: string;
  onClick: (id: string) => void;
}

export default function WordCard({
  id,
  text,
  selected,
  shaking,
  merging,
  onClick,
}: WordCardProps) {
  const classes = [
    "word-card",
    selected && !merging ? "selected" : "",
    shaking ? "shake" : "",
    merging ? "merging" : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <button
      className={classes}
      onClick={() => onClick(id)}
      aria-pressed={selected}
      style={{
        background: merging || (selected ? "var(--color-card-selected)" : "var(--color-card)"),
        color: merging ? "transparent" : selected ? "var(--color-text-on-dark)" : "var(--color-text)",
        border: "none",
        borderRadius: "var(--radius)",
        padding: "1rem 0.5rem",
        fontWeight: 700,
        fontSize: "0.875rem",
        textTransform: "uppercase",
        letterSpacing: "0.06em",
        cursor: "pointer",
        userSelect: "none",
        transform: selected && !merging ? "scale(1.04)" : "scale(1)",
        aspectRatio: "1 / 1",
        width: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        textAlign: "center",
        lineHeight: 1.2,
        boxShadow: selected && !merging ? "var(--shadow-sm)" : "none",
      }}
    >
      {text}
    </button>
  );
}
