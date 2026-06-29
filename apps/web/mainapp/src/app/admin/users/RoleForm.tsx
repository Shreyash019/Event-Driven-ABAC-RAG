"use client";

import { useActionState } from "react";
import { assignRole, removeRole } from "@/lib/admin-actions";
import type { AdminUser } from "./GrantForm";

/**
 * Shows a user's current (scoped) role assignments with remove buttons, plus a form to
 * assign a role at a tenant/department scope. Posts to scoped Server Actions; the server
 * enforces that the caller may assign within that scope (a 403 surfaces as an error).
 */
export function RoleForm({
  user,
  availableRoles,
}: {
  user: AdminUser;
  availableRoles: string[];
}) {
  const [assignState, assignAction, assigning] = useActionState(assignRole, undefined);
  const [, removeAction] = useActionState(removeRole, undefined);

  return (
    <div style={styles.wrap}>
      <div style={styles.chips}>
        {user.roles.length === 0 ? (
          <span style={{ opacity: 0.5, fontSize: "0.8rem" }}>none</span>
        ) : (
          user.roles.map((r, i) => (
            <form key={i} action={removeAction} style={styles.chip}>
              <input type="hidden" name="userId" value={user.id} />
              <input type="hidden" name="roleName" value={r.role} />
              <input type="hidden" name="scopeTenant" value={r.scopeTenant ?? ""} />
              <input type="hidden" name="scopeDepartment" value={r.scopeDepartment ?? ""} />
              <span style={{ fontSize: "0.78rem" }}>
                {r.role}@{r.scopeTenant ?? "*"}/{r.scopeDepartment ?? "*"}
              </span>
              <button type="submit" title="Remove role" style={styles.remove}>
                ×
              </button>
            </form>
          ))
        )}
      </div>

      <form action={assignAction} style={styles.assign}>
        <input type="hidden" name="userId" value={user.id} />
        <select name="roleName" aria-label="role" style={styles.select}>
          {availableRoles.map((r) => (
            <option key={r} value={r}>
              {r}
            </option>
          ))}
        </select>
        <input name="scopeTenant" placeholder="tenant *" aria-label="scope tenant" style={styles.input} />
        <input name="scopeDepartment" placeholder="dept *" aria-label="scope department" style={styles.input} />
        <button type="submit" disabled={assigning} style={styles.button}>
          {assigning ? "…" : "Add"}
        </button>
        {assignState?.error ? (
          <span style={{ color: "#e5484d", fontSize: "0.75rem" }}>{assignState.error}</span>
        ) : null}
      </form>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  wrap: { display: "flex", flexDirection: "column", gap: "0.4rem" },
  chips: { display: "flex", flexWrap: "wrap", gap: "0.3rem" },
  chip: {
    display: "inline-flex",
    alignItems: "center",
    gap: "0.25rem",
    border: "1px solid rgba(127,127,127,0.3)",
    borderRadius: "6px",
    padding: "0.1rem 0.4rem",
  },
  remove: { border: "none", background: "transparent", cursor: "pointer", color: "#e5484d", fontSize: "1rem", lineHeight: 1 },
  assign: { display: "flex", flexWrap: "wrap", gap: "0.3rem", alignItems: "center" },
  select: {
    padding: "0.3rem",
    borderRadius: "6px",
    border: "1px solid rgba(127,127,127,0.4)",
    background: "transparent",
    color: "inherit",
  },
  input: {
    padding: "0.3rem 0.45rem",
    borderRadius: "6px",
    border: "1px solid rgba(127,127,127,0.4)",
    background: "transparent",
    color: "inherit",
    width: "6rem",
  },
  button: {
    padding: "0.3rem 0.7rem",
    borderRadius: "6px",
    border: "none",
    background: "#6366f1",
    color: "white",
    cursor: "pointer",
  },
};
