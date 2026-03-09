"use client";

interface SystemButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "ghost";
}

export default function SystemButton({
  variant = "primary",
  children,
  style,
  ...props
}: SystemButtonProps) {
  const base: React.CSSProperties = {
    padding: "0.65rem 1.25rem",
    borderRadius: "var(--radius)",
    fontWeight: 600,
    fontSize: "0.95rem",
    border: "none",
    transition: "opacity var(--transition)",
    cursor: "pointer",
  };

  const variants: Record<string, React.CSSProperties> = {
    primary: {
      background: "var(--color-card-selected)",
      color: "#fff",
    },
    ghost: {
      background: "transparent",
      border: "1px solid var(--color-border)",
      color: "var(--color-text)",
    },
  };

  return (
    <button style={{ ...base, ...variants[variant], ...style }} {...props}>
      {children}
    </button>
  );
}
