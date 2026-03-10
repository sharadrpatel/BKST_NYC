"use client";

interface SystemButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "ghost" | "danger";
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
    fontSize: "0.925rem",
    border: "none",
    transition: "opacity var(--transition), background var(--transition), transform var(--transition-fast)",
    cursor: "pointer",
    letterSpacing: "0.01em",
  };

  const variants: Record<string, React.CSSProperties> = {
    primary: {
      background: "var(--color-card-selected)",
      color: "var(--color-text-on-dark)",
    },
    ghost: {
      background: "transparent",
      border: "1.5px solid var(--color-border-strong)",
      color: "var(--color-text)",
    },
    danger: {
      background: "var(--color-error-bg)",
      border: "1px solid rgba(192, 57, 43, 0.25)",
      color: "var(--color-error)",
    },
  };

  const disabledStyle: React.CSSProperties = props.disabled
    ? { opacity: 0.38, cursor: "not-allowed", pointerEvents: "none" }
    : {};

  return (
    <button
      style={{ ...base, ...variants[variant], ...disabledStyle, ...style }}
      {...props}
    >
      {children}
    </button>
  );
}
