import { NextRequest, NextResponse } from "next/server";
import { getAdminApiUrl } from "@/lib/admin-api";
import { ROUTES } from "@/lib/routes";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { token, new_password } = body;

    if (!token || !new_password) {
      return NextResponse.json(
        { detail: "Token and new password are required" },
        { status: 400 }
      );
    }

    const res = await fetch(`${getAdminApiUrl()}${ROUTES.API_AUTH_RESET_PASSWORD}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, new_password }),
    });

    const data = await res.json();

    if (!res.ok) {
      return NextResponse.json(
        data || { detail: "Failed to reset password" },
        { status: res.status }
      );
    }

    return NextResponse.json(data);
  } catch (e) {
    console.error("Reset password proxy error:", e);
    return NextResponse.json(
      { detail: "Internal server error" },
      { status: 500 }
    );
  }
}
