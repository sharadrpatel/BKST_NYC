"use client";

interface WordCardProps {
  id: string;
  text: string;
  selected: boolean;
  shaking: boolean;
  onClick: (id: string) => void;
}

export default function WordCard({
  id,
  text,
  selected,
  shaking,
  onClick,
}: WordCardProps) {
  const classes = [
    "word-card",
    selected ? "selected" : "",
    shaking  ? "shake"    : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <button
      className={classes}
      onClick={() => onClick(id)}
      aria-pressed={selected}
      style={{
        background: selected ? "var(--color-card-selected)" : "var(--color-card)",
        color: "var(--color-text)",
        border: "none",
        borderRadius: "var(--radius)",
        padding: "1rem 0.5rem",
        fontWeight: 700,
        fontSize: "0.875rem",
        textTransform: "uppercase",
        letterSpacing: "0.06em",
        cursor: "pointer",
        userSelect: "none",
        transform: selected ? "scale(1.04)" : "scale(1)",
        aspectRatio: "1 / 1",
        width: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        textAlign: "center",
        lineHeight: 1.2,
      }}
    >
      {text}
    </button>
  );
}
