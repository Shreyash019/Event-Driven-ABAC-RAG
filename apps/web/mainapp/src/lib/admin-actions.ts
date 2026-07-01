"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";

/**
 * Admin Server Action: grant ABAC attributes to a user. Runs server-side, forwards the
 * httpOnly session cookie to the gateway, and revalidates the list on success. The gateway
 * + auth-service enforce scoped RBAC — a dept-admin can only grant within their scope, so
 * a 403 here is the server refusing, not the UI.
 */
const GATEWAY_URL = process.env.GATEWAY_URL ?? "http://localhost:8080";

export async function grantUser(
  _prevState: { error?: string; ok?: boolean } | undefined,
  formData: FormData,
): Promise<{ error?: string; ok?: boolean }> {
  const userId = String(formData.get("userId") ?? "");
  const department = String(formData.get("department") ?? "").trim();
  const clearanceRaw = String(formData.get("clearance") ?? "").trim();
  const levelRaw = String(formData.get("level") ?? "").trim();

  const body: Record<string, unknown> = {};
  if (department) body.department = department;
  if (clearanceRaw) body.clearance = Number(clearanceRaw);
  if (levelRaw) body.level = Number(levelRaw);

  const jar = await cookies();
  const res = await fetch(`${GATEWAY_URL}/api/auth/users/${userId}/grant`, {
    method: "POST",
    headers: { "content-type": "application/json", cookie: jar.toString() },
    body: JSON.stringify(body),
    cache: "no-store",
  });

  if (!res.ok) {
    return {
      error:
        res.status === 403
          ? "Not permitted for that scope."
          : "Could not update user.",
    };
  }

  revalidatePath("/admin/users");
  return { ok: true };
}

function roleBody(formData: FormData): Record<string, string> {
  const body: Record<string, string> = { roleName: String(formData.get("roleName") ?? "") };
  const tenant = String(formData.get("scopeTenant") ?? "").trim();
  const department = String(formData.get("scopeDepartment") ?? "").trim();
  if (tenant) body.scopeTenant = tenant;
  if (department) body.scopeDepartment = department;
  return body;
}

async function roleRequest(
  method: "POST" | "DELETE",
  userId: string,
  body: Record<string, string>,
): Promise<{ error?: string; ok?: boolean }> {
  const jar = await cookies();
  const res = await fetch(`${GATEWAY_URL}/api/auth/users/${userId}/roles`, {
    method,
    headers: { "content-type": "application/json", cookie: jar.toString() },
    body: JSON.stringify(body),
    cache: "no-store",
  });
  if (!res.ok) {
    return { error: res.status === 403 ? "Not permitted for that scope." : "Role update failed." };
  }
  revalidatePath("/admin/users");
  return { ok: true };
}

export async function assignRole(
  _prevState: { error?: string; ok?: boolean } | undefined,
  formData: FormData,
): Promise<{ error?: string; ok?: boolean }> {
  return roleRequest("POST", String(formData.get("userId") ?? ""), roleBody(formData));
}

export async function removeRole(
  _prevState: { error?: string; ok?: boolean } | undefined,
  formData: FormData,
): Promise<{ error?: string; ok?: boolean }> {
  return roleRequest("DELETE", String(formData.get("userId") ?? ""), roleBody(formData));
}

export async function createDepartment(
  _prevState: { error?: string; ok?: boolean } | undefined,
  formData: FormData,
): Promise<{ error?: string; ok?: boolean }> {
  const slug = String(formData.get("slug") ?? "").trim();
  const name = String(formData.get("name") ?? "").trim();
  const parentSlug = String(formData.get("parentSlug") ?? "").trim();
  const jar = await cookies();
  const res = await fetch(`${GATEWAY_URL}/api/auth/departments`, {
    method: "POST",
    headers: { "content-type": "application/json", cookie: jar.toString() },
    body: JSON.stringify({ slug, name, ...(parentSlug ? { parentSlug } : {}) }),
    cache: "no-store",
  });
  if (!res.ok) {
    return {
      error: res.status === 409 ? "That slug already exists." : "Could not create department.",
    };
  }
  revalidatePath("/admin/users");
  return { ok: true };
}

/** Replace a user's department memberships AND compartments in one save. */
export async function setUserOrg(
  _prevState: { error?: string; ok?: boolean } | undefined,
  formData: FormData,
): Promise<{ error?: string; ok?: boolean }> {
  const userId = String(formData.get("userId") ?? "");
  const slugs = formData.getAll("slug").map(String);
  const keys = formData.getAll("compartment").map(String);
  // Each checked department carries its own rank field (rank_<slug>); default IC.
  const memberships = slugs.map((slug) => ({
    slug,
    rank: String(formData.get(`rank_${slug}`) ?? "IC"),
  }));

  const jar = await cookies();
  const cookie = jar.toString();
  const headers = { "content-type": "application/json", cookie };
  const [deptRes, compRes] = await Promise.all([
    fetch(`${GATEWAY_URL}/api/auth/users/${userId}/departments`, {
      method: "PUT",
      headers,
      body: JSON.stringify({ memberships }),
      cache: "no-store",
    }),
    fetch(`${GATEWAY_URL}/api/auth/users/${userId}/compartments`, {
      method: "PUT",
      headers,
      body: JSON.stringify({ keys }),
      cache: "no-store",
    }),
  ]);
  if (!deptRes.ok || !compRes.ok) {
    const forbidden = deptRes.status === 403 || compRes.status === 403;
    return { error: forbidden ? "Not permitted (needs org:manage)." : "Update failed." };
  }
  revalidatePath("/admin/users");
  return { ok: true };
}
