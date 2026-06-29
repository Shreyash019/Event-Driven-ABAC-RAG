"use client";

import { useActionState } from "react";
import { grantUser } from "@/lib/admin-actions";

export interface RoleAssignment {
  role: string;
  scopeTenant: string | null;
  scopeDepartment: string | null;
}

export interface AdminUser {
  id: string;
  email: string;
  name: string;
  tenant: string;
  department: string;
  clearance: number;
  status: string;
  roles: RoleAssignment[];
  departments: Array<{ slug: string; isManager: boolean }>;
  compartments: string[];
}

/** Per-row grant form. Posts to the grantUser Server Action; RBAC scope is enforced server-side. */
export function GrantForm({ user }: { user: AdminUser }) {
  const [state, action, pending] = useActionState(grantUser, undefined);

  return (
    <form action={action} style={styles.form}>
      <input type="hidden" name="userId" value={user.id} />
      <input
        name="department"
        defaultValue={user.department}
        aria-label="department"
        style={styles.input}
      />
      <input
        name="clearance"
        type="number"
        min={0}
        max={10}
        defaultValue={user.clearance}
        aria-label="clearance"
        style={{ ...styles.input, width: "4rem" }}
      />
      <button type="submit" disabled={pending} style={styles.button}>
        {pending ? "…" : "Save"}
      </button>
      {state?.ok ? <span style={{ color: "#30a46c" }}>✓</span> : null}
      {state?.error ? <span style={{ color: "#e5484d" }}>{state.error}</span> : null}
    </form>
  );
}

const styles: Record<string, React.CSSProperties> = {
  form: { display: "flex", gap: "0.4rem", alignItems: "center" },
  input: {
    padding: "0.3rem 0.45rem",
    borderRadius: "6px",
    border: "1px solid rgba(127,127,127,0.4)",
    background: "transparent",
    color: "inherit",
  },
  button: {
    padding: "0.3rem 0.7rem",
    borderRadius: "6px",
    border: "none",
    background: "#3b82f6",
    color: "white",
    cursor: "pointer",
  },
};
