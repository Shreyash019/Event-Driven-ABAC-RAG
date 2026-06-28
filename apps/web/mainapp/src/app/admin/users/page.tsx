import { cookies } from "next/headers";
import { GrantForm, type AdminUser } from "./GrantForm";

/**
 * Admin user management (SSR). Fetches the scoped user list from the gateway with the
 * httpOnly session cookie — the list is already filtered to the caller's RBAC scope by
 * auth-service, and a non-admin gets 403 (we render a friendly notice). No token reaches
 * the browser; the page is server-rendered.
 */
const GATEWAY_URL = process.env.GATEWAY_URL ?? "http://localhost:8080";

async function fetchUsers(): Promise<{ users: AdminUser[]; forbidden: boolean }> {
  const access = (await cookies()).get("arac_session")?.value;
  if (!access) return { users: [], forbidden: true };

  const res = await fetch(`${GATEWAY_URL}/api/auth/users`, {
    headers: { cookie: `arac_session=${access}` },
    cache: "no-store",
  });
  if (res.status === 403 || res.status === 401) return { users: [], forbidden: true };
  if (!res.ok) return { users: [], forbidden: false };
  return { users: (await res.json()) as AdminUser[], forbidden: false };
}

export default async function AdminUsersPage() {
  const { users, forbidden } = await fetchUsers();

  if (forbidden) {
    return (
      <main style={{ padding: "2rem" }}>
        <h1 style={{ fontSize: "1.5rem" }}>Users</h1>
        <p style={{ opacity: 0.8 }}>You don’t have permission to manage users.</p>
      </main>
    );
  }

  return (
    <main style={{ padding: "2rem", display: "flex", flexDirection: "column", gap: "1rem" }}>
      <h1 style={{ fontSize: "1.5rem", margin: 0 }}>Users ({users.length})</h1>
      <p style={{ margin: 0, opacity: 0.7, fontSize: "0.9rem" }}>
        Showing users within your scope. Set department / clearance and Save.
      </p>
      <table style={{ borderCollapse: "collapse", width: "100%" }}>
        <thead>
          <tr style={{ textAlign: "left", borderBottom: "1px solid rgba(127,127,127,0.3)" }}>
            <th style={th}>Name</th>
            <th style={th}>Email</th>
            <th style={th}>Tenant</th>
            <th style={th}>Status</th>
            <th style={th}>Grant (department · clearance)</th>
          </tr>
        </thead>
        <tbody>
          {users.map((u) => (
            <tr key={u.id} style={{ borderBottom: "1px solid rgba(127,127,127,0.15)" }}>
              <td style={td}>{u.name}</td>
              <td style={td}>{u.email}</td>
              <td style={td}>{u.tenant}</td>
              <td style={td}>{u.status}</td>
              <td style={td}>
                <GrantForm user={u} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </main>
  );
}

const th: React.CSSProperties = { padding: "0.5rem 0.75rem", fontSize: "0.85rem", opacity: 0.8 };
const td: React.CSSProperties = { padding: "0.5rem 0.75rem", fontSize: "0.9rem" };
