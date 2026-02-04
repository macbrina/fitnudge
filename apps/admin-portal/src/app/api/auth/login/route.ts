import { NextRequest, NextResponse } from "next/server";
import { getAdminApiUrl } from "@/lib/admin-api";
import { ROUTES } from "@/lib/routes";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, password } = body;

    if (!email || !password) {
      return NextResponse.json(
        { detail: "Email and password required" },
        { status: 400 }
      );
    }

    const res = await fetch(`${getAdminApiUrl()}${ROUTES.API_AUTH_LOGIN}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });

    const data = await res.json();

    if (!res.ok) {
      return NextResponse.json(
        data || { detail: "Login failed" },
        { status: res.status }
      );
    }

    const token = data.access_token;
    if (!token) {
      return NextResponse.json(
        { detail: "Invalid response from auth service" },
        { status: 500 }
      );
    }

    const response = NextResponse.json(data);
    response.cookies.set("admin_token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 8, // 8 hours
    });

    return response;
  } catch (e) {
    console.error("Login proxy error:", e);
    return NextResponse.json(
      { detail: "Internal server error" },
      { status: 500 }
    );
  }
}
