"use client";

import { useActionState } from "react";
import { login } from "@/lib/auth-actions";

/**
 * Login form. The form posts directly to the `login` Server Action — credentials go
 * straight to the server (never held in client state beyond the input), and on success
 * the action sets httpOnly cookies and redirects. Only `error` (a generic, non-enumerating
 * message) comes back to the client.
 */
export default function LoginPage() {
  const [state, formAction, pending] = useActionState(login, undefined);

  return (
    <main style={styles.main}>
      <form action={formAction} style={styles.card}>
        <h1 style={styles.title}>Sign in</h1>

        <label style={styles.label}>
          Email
          <input
            name="email"
            type="email"
            autoComplete="username"
            required
            style={styles.input}
          />
        </label>

        <label style={styles.label}>
          Password
          <input
            name="password"
            type="password"
            autoComplete="current-password"
            required
            style={styles.input}
          />
        </label>

        {state?.error ? <p style={styles.error}>{state.error}</p> : null}

        <button type="submit" disabled={pending} style={styles.button}>
          {pending ? "Signing in…" : "Sign in"}
        </button>

        <p style={styles.hint}>
          No account?{" "}
          <a href="/signup" style={styles.link}>
            Create one
          </a>
        </p>
      </form>
    </main>
  );
}

const styles: Record<string, React.CSSProperties> = {
  main: {
    minHeight: "70vh",
    display: "grid",
    placeItems: "center",
    padding: "2rem",
  },
  card: {
    display: "flex",
    flexDirection: "column",
    gap: "1rem",
    width: "min(360px, 100%)",
    padding: "2rem",
    border: "1px solid rgba(127,127,127,0.25)",
    borderRadius: "12px",
  },
  title: { margin: 0, fontSize: "1.5rem" },
  label: { display: "flex", flexDirection: "column", gap: "0.35rem", fontSize: "0.9rem" },
  input: {
    padding: "0.6rem 0.75rem",
    borderRadius: "8px",
    border: "1px solid rgba(127,127,127,0.4)",
    background: "transparent",
    color: "inherit",
    fontSize: "1rem",
  },
  error: { margin: 0, color: "#e5484d", fontSize: "0.9rem" },
  button: {
    padding: "0.7rem",
    borderRadius: "8px",
    border: "none",
    background: "#3b82f6",
    color: "white",
    fontSize: "1rem",
    cursor: "pointer",
  },
  hint: { margin: 0, fontSize: "0.85rem", textAlign: "center", opacity: 0.8 },
  link: { color: "#3b82f6" },
};
