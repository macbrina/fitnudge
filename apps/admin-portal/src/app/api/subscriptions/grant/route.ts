import { NextRequest, NextResponse } from "next/server";
import { getAdminApiUrl } from "@/lib/admin-api";

export async function POST(request: NextRequest) {
  const token = request.cookies.get("admin_token")?.value;

  if (!token) {
    return NextResponse.json({ detail: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json().catch(() => ({}));
    const user_id = body?.user_id ?? "";
    const plan_id = body?.plan_id ?? "premium";
    const days = body?.days ?? 30;
    const searchParams = new URLSearchParams();
    searchParams.set("user_id", String(user_id));
    searchParams.set("plan_id", String(plan_id));
    searchParams.set("days", String(Math.max(1, Math.min(365, Number(days) || 30))));
    const query = searchParams.toString();

    const res = await fetch(`${getAdminApiUrl()}/api/subscriptions/grant?${query}`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await res.json();

    if (!res.ok) {
      return NextResponse.json(data || { detail: "Grant failed" }, { status: res.status });
    }

    return NextResponse.json(data);
  } catch (e) {
    console.error("Subscriptions grant proxy error:", e);
    return NextResponse.json(
      { detail: "Internal server error" },
      { status: 500 }
    );
  }
}
