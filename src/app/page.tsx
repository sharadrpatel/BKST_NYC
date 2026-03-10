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
        padding: "1.5rem",
        background: "var(--color-bg)",
      }}
    >
      {/* Brand masthead */}
      <div
        style={{
          textAlign: "center",
          marginBottom: "2.5rem",
        }}
      >
        <p
          style={{
            fontSize: "0.7rem",
            fontWeight: 600,
            letterSpacing: "0.2em",
            textTransform: "uppercase",
            color: "var(--color-text-muted)",
            marginBottom: "0.6rem",
          }}
        >
          Today&apos;s Puzzle
        </p>
        <h1
          style={{
            fontSize: "clamp(2.2rem, 6vw, 3rem)",
            fontWeight: 800,
            letterSpacing: "-0.04em",
            color: "var(--color-text)",
            lineHeight: 1.1,
          }}
        >
          The Akshar Times
        </h1>
        <div
          style={{
            width: "100%",
            height: "2px",
            background: "var(--color-text)",
            borderRadius: "1px",
            marginTop: "0.75rem",
          }}
        />
        <p
          style={{
            color: "var(--color-text-muted)",
            fontSize: "0.9rem",
            marginTop: "0.6rem",
            fontWeight: 400,
          }}
        >
          Group the 16 words into four categories.
        </p>
      </div>

      {/* Login card */}
      <div
        style={{
          background: "var(--color-surface)",
          border: "1px solid var(--color-border)",
          borderRadius: "var(--radius-lg)",
          padding: "2rem",
          width: "100%",
          maxWidth: 360,
          boxShadow: "var(--shadow-md)",
        }}
      >
        <p
          style={{
            fontSize: "0.8rem",
            fontWeight: 600,
            letterSpacing: "0.08em",
            textTransform: "uppercase",
            color: "var(--color-text-muted)",
            marginBottom: "1.25rem",
          }}
        >
          Enter your BKID
        </p>

        <form
          action={login}
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "0.75rem",
          }}
        >
          <input
            name="code"
            type="text"
            placeholder="e.g. 6824"
            autoComplete="off"
            autoFocus
            required
            className={`field-input${hasError ? " field-input--error" : ""}`}
            style={{
              textTransform: "uppercase",
              letterSpacing: "0.12em",
              fontWeight: 600,
              fontSize: "1.05rem",
            }}
          />

          {hasError && (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "0.4rem",
                background: "var(--color-error-bg)",
                border: "1px solid rgba(192, 57, 43, 0.2)",
                borderRadius: "var(--radius-sm)",
                padding: "0.5rem 0.75rem",
              }}
            >
              <span style={{ fontSize: "0.85rem", color: "var(--color-error)", fontWeight: 500 }}>
                Invalid BKID — please try again.
              </span>
            </div>
          )}

          <button
            type="submit"
            className="btn-login"
            style={{
              padding: "0.85rem",
              borderRadius: "var(--radius)",
              border: "none",
              background: "var(--color-card-selected)",
              color: "var(--color-text-on-dark)",
              fontWeight: 700,
              fontSize: "1rem",
              cursor: "pointer",
              letterSpacing: "0.02em",
              marginTop: "0.25rem",
            }}
          >
            Play today&apos;s puzzle →
          </button>
        </form>
      </div>

      {/* Footer note */}
      <p
        style={{
          marginTop: "2rem",
          fontSize: "0.78rem",
          color: "var(--color-text-muted)",
          textAlign: "center",
          maxWidth: 300,
          lineHeight: 1.6,
        }}
      >
        Each BKID is valid for one puzzle attempt.
      </p>
    </main>
  );
}
