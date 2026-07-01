"use client";

import { useActionState } from "react";
import { grantUser } from "@/lib/admin-actions";

export interface RoleAssignment {
  role: string;
  scopeTenant: string | null;
  scopeDepartment: string | null;
}

/**
 * In-department role ladder (least → most senior), mirroring the `DeptRank` enum in the
 * auth-service Prisma schema. MANAGER and above inherit visibility of sub-departments.
 */
export const DEPT_RANKS = [
  "IC",
  "LEAD",
  "MANAGER",
  "SENIOR_MANAGER",
  "DIRECTOR",
  "VP",
] as const;
export type DeptRank = (typeof DEPT_RANKS)[number];

export interface AdminUser {
  id: string;
  email: string;
  name: string;
  tenant: string;
  department: string;
  clearance: number;
  /** Company-wide seniority level (L3 = intern floor). */
  level: number;
  status: string;
  roles: RoleAssignment[];
  departments: Array<{ slug: string; rank: DeptRank }>;
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
        title="document clearance (no read up)"
        style={{ ...styles.input, width: "4rem" }}
      />
      <input
        name="level"
        type="number"
        min={3}
        max={12}
        defaultValue={user.level}
        aria-label="level"
        title="company level (L3 = intern floor)"
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
