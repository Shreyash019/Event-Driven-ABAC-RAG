"use client";

import { useActionState } from "react";
import { changePassword } from "@/lib/auth-actions";

/**
 * Account settings — change password. Protected by middleware (signed-in only). Posts to
 * the `changePassword` Server Action, which verifies the current password, revokes every
 * session, and re-issues this device's session. On success we show a confirmation.
 */
export default function AccountPage() {
  const [state, formAction, pending] = useActionState(changePassword, undefined);

  return (
    <main style={styles.main}>
      <form action={formAction} style={styles.card}>
        <h1 style={styles.title}>Change password</h1>

        <label style={styles.label}>
          Current password
          <input
            name="currentPassword"
            type="password"
            autoComplete="current-password"
            required
            style={styles.input}
          />
        </label>

        <label style={styles.label}>
          New password
          <input
            name="newPassword"
            type="password"
            autoComplete="new-password"
            minLength={8}
            required
            style={styles.input}
          />
        </label>

        {state?.error ? <p style={styles.error}>{state.error}</p> : null}
        {state?.success ? (
          <p style={styles.success}>Password updated. Other sessions were signed out.</p>
        ) : null}

        <button type="submit" disabled={pending} style={styles.button}>
          {pending ? "Updating…" : "Update password"}
        </button>
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
  success: { margin: 0, color: "#30a46c", fontSize: "0.9rem" },
  button: {
    padding: "0.7rem",
    borderRadius: "8px",
    border: "none",
    background: "#3b82f6",
    color: "white",
    fontSize: "1rem",
    cursor: "pointer",
  },
};
