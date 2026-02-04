import { NextRequest, NextResponse } from "next/server";
import { getAdminApiUrl } from "@/lib/admin-api";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const token = request.cookies.get("admin_token")?.value;

  if (!token) {
    return NextResponse.json({ detail: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const { searchParams } = new URL(request.url);
  const limit = searchParams.get("limit") || "50";

  try {
    const res = await fetch(
      `${getAdminApiUrl()}/api/users/${id}/activity?limit=${limit}`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    const data = await res.json();

    if (!res.ok) {
      return NextResponse.json(data || { detail: "Request failed" }, { status: res.status });
    }

    return NextResponse.json(data);
  } catch (e) {
    console.error("User activity proxy error:", e);
    return NextResponse.json(
      { detail: "Internal server error" },
      { status: 500 }
    );
  }
}
