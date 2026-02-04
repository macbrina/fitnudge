import { NextRequest, NextResponse } from "next/server";
import { getAdminApiUrl } from "@/lib/admin-api";
import { ROUTES } from "@/lib/routes";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { token } = body;

    if (!token) {
      return NextResponse.json(
        { detail: "Token is required" },
        { status: 400 }
      );
    }

    const res = await fetch(
      `${getAdminApiUrl()}${ROUTES.API_AUTH_RESET_PASSWORD_VALIDATE}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      }
    );

    const data = await res.json();

    if (!res.ok) {
      return NextResponse.json(
        data || { detail: "Invalid or expired token" },
        { status: res.status }
      );
    }

    return NextResponse.json(data);
  } catch (e) {
    console.error("Reset password validate proxy error:", e);
    return NextResponse.json(
      { detail: "Internal server error" },
      { status: 500 }
    );
  }
}
