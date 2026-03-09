import { login } from "@/actions/auth";

interface Props {
  searchParams: Promise<{ error?: string }>;
}

export default async function LoginPage({ searchParams }: Props) {
  const params = await searchParams;
  const hasError = params.error === "invalid";

  return (
    <main
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        minHeight: "100vh",
        gap: "1.5rem",
        padding: "1rem",
      }}
    >
      <h1 style={{ fontSize: "2rem", fontWeight: 700, letterSpacing: "-0.02em" }}>
        BKST NYC
      </h1>
      <p style={{ color: "var(--color-text-muted)", fontSize: "0.95rem" }}>
        Enter your BKID to play.
      </p>

      <form
        action={login}
        style={{
          display: "flex",
          flexDirection: "column",
          gap: "0.75rem",
          width: "100%",
          maxWidth: 320,
        }}
      >
        <input
          name="code"
          type="text"
          placeholder="e.g. 6824"
          autoComplete="off"
          autoFocus
          required
          style={{
            padding: "0.75rem 1rem",
            borderRadius: "var(--radius)",
            border: `1px solid ${hasError ? "#e94560" : "var(--color-border)"}`,
            background: "var(--color-surface)",
            color: "var(--color-text)",
            fontSize: "1rem",
            textTransform: "uppercase",
            letterSpacing: "0.1em",
            outline: "none",
          }}
        />

        {hasError && (
          <p
            style={{
              color: "#e94560",
              fontSize: "0.85rem",
              textAlign: "center",
              margin: "-0.25rem 0",
            }}
          >
            Invalid BKID. Try again.
          </p>
        )}

        <button
          type="submit"
          style={{
            padding: "0.75rem",
            borderRadius: "var(--radius)",
            border: "none",
            background: "var(--color-card-selected)",
            color: "#fff",
            fontWeight: 600,
            fontSize: "1rem",
            cursor: "pointer",
          }}
        >
          Play
        </button>
      </form>
    </main>
  );
}
