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

  const body: Record<string, unknown> = {};
  if (department) body.department = department;
  if (clearanceRaw) body.clearance = Number(clearanceRaw);

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
