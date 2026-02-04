import { NextRequest, NextResponse } from "next/server";
import { getAdminApiUrl } from "@/lib/admin-api";
import { ROUTES } from "@/lib/routes";

export async function POST(request: NextRequest) {
  const token = request.cookies.get("admin_token")?.value;

  if (token) {
    try {
      await fetch(`${getAdminApiUrl()}${ROUTES.API_AUTH_LOGOUT}`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
    } catch {
      // Ignore - we'll clear cookie anyway
    }
  }

  const response = NextResponse.json({ message: "Logged out" });
  response.cookies.delete("admin_token");
  return response;
}
