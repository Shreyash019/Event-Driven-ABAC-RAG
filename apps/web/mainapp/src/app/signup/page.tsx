"use client";

import { useActionState } from "react";
import { signup } from "@/lib/auth-actions";

/**
 * Signup form. Posts to the `signup` Server Action. The new account is created with no
 * access scope (clearance 0) server-side; on success the user is auto-logged-in and sent
 * home. The form only ever collects name/email/password — never any access scope.
 */
export default function SignupPage() {
  const [state, formAction, pending] = useActionState(signup, undefined);

  return (
    <main style={styles.main}>
      <form action={formAction} style={styles.card}>
        <h1 style={styles.title}>Create account</h1>

        <label style={styles.label}>
          Name
          <input name="name" type="text" autoComplete="name" required style={styles.input} />
        </label>

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
            autoComplete="new-password"
            minLength={8}
            required
            style={styles.input}
          />
        </label>

        {state?.error ? <p style={styles.error}>{state.error}</p> : null}

        <button type="submit" disabled={pending} style={styles.button}>
          {pending ? "Creating…" : "Create account"}
        </button>

        <p style={styles.hint}>
          Already have an account?{" "}
          <a href="/login" style={styles.link}>
            Sign in
          </a>
        </p>
      </form>
    </main>
  );
}

const styles: Record<string, React.CSSProperties> = {
  main: { minHeight: "70vh", display: "grid", placeItems: "center", padding: "2rem" },
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
