import { NextRequest, NextResponse } from "next/server";
import { getAdminApiUrl } from "@/lib/admin-api";
import { ROUTES } from "@/lib/routes";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email } = body;

    if (!email || typeof email !== "string") {
      return NextResponse.json(
        { detail: "Email is required" },
        { status: 400 }
      );
    }

    const res = await fetch(`${getAdminApiUrl()}${ROUTES.API_AUTH_FORGOT_PASSWORD}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: email.trim().toLowerCase() }),
    });

    const data = await res.json();

    if (!res.ok) {
      return NextResponse.json(
        data || { detail: "Failed to send reset email" },
        { status: res.status }
      );
    }

    return NextResponse.json(data);
  } catch (e) {
    console.error("Forgot password proxy error:", e);
    return NextResponse.json(
      { detail: "Internal server error" },
      { status: 500 }
    );
  }
}
