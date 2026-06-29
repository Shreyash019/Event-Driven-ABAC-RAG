"use client";

import { useActionState } from "react";
import { createDepartment } from "@/lib/admin-actions";

/** Create a department (optionally under a parent). Requires org:manage server-side. */
export function CreateDepartmentForm({
  departments,
}: {
  departments: Array<{ slug: string; name: string }>;
}) {
  const [state, action, pending] = useActionState(createDepartment, undefined);

  return (
    <form action={action} style={styles.form}>
      <strong style={{ fontSize: "0.9rem" }}>New department</strong>
      <input name="slug" placeholder="slug (e.g. finance.tax)" required style={styles.input} />
      <input name="name" placeholder="Display name" required style={styles.input} />
      <select name="parentSlug" aria-label="parent department" style={styles.input} defaultValue="">
        <option value="">— no parent (top level) —</option>
        {departments.map((d) => (
          <option key={d.slug} value={d.slug}>
            {d.slug}
          </option>
        ))}
      </select>
      <button type="submit" disabled={pending} style={styles.button}>
        {pending ? "Creating…" : "Create"}
      </button>
      {state?.ok ? <span style={{ color: "#30a46c" }}>✓ created</span> : null}
      {state?.error ? <span style={{ color: "#e5484d", fontSize: "0.85rem" }}>{state.error}</span> : null}
    </form>
  );
}

const styles: Record<string, React.CSSProperties> = {
  form: { display: "flex", flexWrap: "wrap", gap: "0.5rem", alignItems: "center" },
  input: {
    padding: "0.4rem 0.6rem",
    borderRadius: "8px",
    border: "1px solid rgba(127,127,127,0.4)",
    background: "transparent",
    color: "inherit",
  },
  button: {
    padding: "0.45rem 0.9rem",
    borderRadius: "8px",
    border: "none",
    background: "#6366f1",
    color: "white",
    cursor: "pointer",
  },
};
