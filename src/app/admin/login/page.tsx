import { adminLogin } from "@/actions/admin";

interface Props {
  searchParams: Promise<{ error?: string }>;
}

export default async function AdminLoginPage({ searchParams }: Props) {
  const params = await searchParams;
  const hasError = !!params.error;

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
      <h1 style={{ fontSize: "1.5rem", fontWeight: 700 }}>Admin Login</h1>

      <form
        action={adminLogin}
        style={{
          display: "flex",
          flexDirection: "column",
          gap: "0.75rem",
          width: "100%",
          maxWidth: 320,
        }}
      >
        <input
          name="password"
          type="password"
          placeholder="Admin key"
          autoFocus
          required
          style={{
            padding: "0.75rem 1rem",
            borderRadius: "var(--radius)",
            border: `1px solid ${hasError ? "#e94560" : "var(--color-border)"}`,
            background: "var(--color-surface)",
            color: "var(--color-text)",
            fontSize: "1rem",
          }}
        />

        {hasError && (
          <p style={{ color: "#e94560", fontSize: "0.85rem", textAlign: "center" }}>
            Incorrect admin key.
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
          Enter
        </button>
      </form>
    </main>
  );
}
