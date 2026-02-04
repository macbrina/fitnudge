import { NextRequest, NextResponse } from "next/server";
import { getAdminApiUrl } from "@/lib/admin-api";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const token = request.cookies.get("admin_token")?.value;

  if (!token) {
    return NextResponse.json({ detail: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const { searchParams } = new URL(request.url);
  const query = searchParams.toString();

  try {
    const res = await fetch(
      `${getAdminApiUrl()}/api/subscriptions/${id}/cancel${query ? `?${query}` : ""}`,
      {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      }
    );
    const data = await res.json();

    if (!res.ok) {
      return NextResponse.json(data || { detail: "Cancel failed" }, { status: res.status });
    }

    return NextResponse.json(data);
  } catch (e) {
    console.error("Subscription cancel proxy error:", e);
    return NextResponse.json(
      { detail: "Internal server error" },
      { status: 500 }
    );
  }
}
