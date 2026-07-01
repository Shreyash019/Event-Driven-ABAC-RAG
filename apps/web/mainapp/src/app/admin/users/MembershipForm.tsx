"use client";

import { useActionState } from "react";
import { setUserOrg } from "@/lib/admin-actions";
import { DEPT_RANKS, type AdminUser } from "./GrantForm";

/**
 * Edit a user's ABAC org placement: department memberships (each with an in-department
 * rank — MANAGER and above inherit sub-departments) and need-to-know compartments. One
 * Save posts both. The server enforces `org:manage`; changes revoke the user's sessions
 * so claims re-derive.
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
  const rankOf = new Map(user.departments.map((d) => [d.slug, d.rank]));
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
            <select
              name={`rank_${d.slug}`}
              defaultValue={rankOf.get(d.slug) ?? "IC"}
              aria-label={`${d.slug} rank`}
              title="in-department rank (MANAGER+ sees sub-departments)"
              style={styles.rank}
            >
              {DEPT_RANKS.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
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
  rank: {
    fontSize: "0.7rem",
    padding: "0.1rem 0.2rem",
    borderRadius: "4px",
    border: "1px solid rgba(127,127,127,0.4)",
    background: "transparent",
    color: "inherit",
  },
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
