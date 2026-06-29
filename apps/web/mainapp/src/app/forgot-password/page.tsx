"use client";

import { useActionState } from "react";
import { requestPasswordReset } from "@/lib/auth-actions";

/**
 * Request a password reset. The response is always the same generic confirmation,
 * whether or not the email exists (no account enumeration). The emailed link lands on
 * /reset-password.
 */
export default function ForgotPasswordPage() {
  const [state, formAction, pending] = useActionState(requestPasswordReset, undefined);

  return (
    <main style={styles.main}>
      <form action={formAction} style={styles.card}>
        <h1 style={styles.title}>Reset password</h1>

        {state?.sent ? (
          <p style={styles.note}>
            If an account exists for that email, a reset link is on its way. Check your inbox
            (in dev, open Mailpit at <code>http://localhost:8025</code>).
          </p>
        ) : (
          <>
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
            <button type="submit" disabled={pending} style={styles.button}>
              {pending ? "Sending…" : "Send reset link"}
            </button>
          </>
        )}

        <p style={styles.hint}>
          <a href="/login" style={styles.link}>
            Back to sign in
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
    width: "min(380px, 100%)",
    padding: "2rem",
    border: "1px solid rgba(127,127,127,0.25)",
    borderRadius: "12px",
  },
  title: { margin: 0, fontSize: "1.5rem" },
  note: { margin: 0, fontSize: "0.9rem", lineHeight: 1.5 },
  label: { display: "flex", flexDirection: "column", gap: "0.35rem", fontSize: "0.9rem" },
  input: {
    padding: "0.6rem 0.75rem",
    borderRadius: "8px",
    border: "1px solid rgba(127,127,127,0.4)",
    background: "transparent",
    color: "inherit",
    fontSize: "1rem",
  },
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
