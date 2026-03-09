// Auth gate is enforced by middleware (src/middleware.ts).
// This layout only provides the admin chrome wrapper.

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div
      style={{
        minHeight: "100vh",
        background: "var(--color-bg)",
        color: "var(--color-text)",
      }}
    >
      {children}
    </div>
  );
}
