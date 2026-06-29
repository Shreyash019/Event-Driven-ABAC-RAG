"use client";

import { useActionState } from "react";
import { setUserOrg } from "@/lib/admin-actions";
import type { AdminUser } from "./GrantForm";

/**
 * Edit a user's ABAC org placement: department memberships (with a per-dept "manager"
 * flag → inherits descendants) and need-to-know compartments. One Save posts both. The
 * server enforces `org:manage`; changes revoke the user's sessions so claims re-derive.
 */
export function MembershipForm({
  user,
  allDepartments,
  allCompartments,
}: {
  user: AdminUser;
  allDepartments: Array<{ slug: string; name: string }>;
  allCompartments: string[];
}) {
  const [state, action, pending] = useActionState(setUserOrg, undefined);
  const member = new Set(user.departments.map((d) => d.slug));
  const manager = new Set(user.departments.filter((d) => d.isManager).map((d) => d.slug));
  const held = new Set(user.compartments);

  return (
    <form action={action} style={styles.form}>
      <input type="hidden" name="userId" value={user.id} />

      <div style={styles.group}>
        {allDepartments.map((d) => (
          <div key={d.slug} style={styles.row}>
            <label style={styles.item}>
              <input type="checkbox" name="slug" value={d.slug} defaultChecked={member.has(d.slug)} />
              {d.slug}
            </label>
            <label style={styles.mgr} title="manager → sees sub-departments">
              <input type="checkbox" name="manager" value={d.slug} defaultChecked={manager.has(d.slug)} />
              mgr
            </label>
          </div>
        ))}
      </div>

      {allCompartments.length > 0 ? (
        <div style={styles.chips}>
          {allCompartments.map((k) => (
            <label key={k} style={styles.item}>
              <input type="checkbox" name="compartment" value={k} defaultChecked={held.has(k)} />
              {k}
            </label>
          ))}
        </div>
      ) : null}

      <div style={styles.actions}>
        <button type="submit" disabled={pending} style={styles.button}>
          {pending ? "…" : "Save org"}
        </button>
        {state?.ok ? <span style={{ color: "#30a46c" }}>✓</span> : null}
        {state?.error ? <span style={{ color: "#e5484d", fontSize: "0.75rem" }}>{state.error}</span> : null}
      </div>
    </form>
  );
}

const styles: Record<string, React.CSSProperties> = {
  form: { display: "flex", flexDirection: "column", gap: "0.4rem", minWidth: "12rem" },
  group: { display: "flex", flexDirection: "column", gap: "0.15rem" },
  row: { display: "flex", alignItems: "center", justifyContent: "space-between", gap: "0.5rem" },
  item: { display: "inline-flex", alignItems: "center", gap: "0.3rem", fontSize: "0.8rem" },
  mgr: { display: "inline-flex", alignItems: "center", gap: "0.2rem", fontSize: "0.7rem", opacity: 0.8 },
  chips: { display: "flex", flexWrap: "wrap", gap: "0.5rem", borderTop: "1px dashed rgba(127,127,127,0.3)", paddingTop: "0.3rem" },
  actions: { display: "flex", alignItems: "center", gap: "0.4rem" },
  button: {
    padding: "0.3rem 0.7rem",
    borderRadius: "6px",
    border: "none",
    background: "#0ea5e9",
    color: "white",
    cursor: "pointer",
  },
};
