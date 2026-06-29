"use client";

import { Suspense, useActionState } from "react";
import { useSearchParams } from "next/navigation";
import { resetPassword } from "@/lib/auth-actions";

/**
 * Set a new password from an emailed reset link (?token=…). On success the action
 * redirects to /login; on an invalid/expired token it shows an error. The token is
 * single-use and short-lived server-side.
 */
function ResetForm() {
  const token = useSearchParams().get("token") ?? "";
  const [state, formAction, pending] = useActionState(resetPassword, undefined);

  return (
    <form action={formAction} style={styles.card}>
      <h1 style={styles.title}>Choose a new password</h1>
      <input type="hidden" name="token" value={token} />
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
      {!token ? <p style={styles.error}>Missing reset token.</p> : null}
      {state?.error ? <p style={styles.error}>{state.error}</p> : null}
      <button type="submit" disabled={pending || !token} style={styles.button}>
        {pending ? "Updating…" : "Update password"}
      </button>
    </form>
  );
}

export default function ResetPasswordPage() {
  return (
    <main style={styles.main}>
      <Suspense fallback={null}>
        <ResetForm />
      </Suspense>
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
};
