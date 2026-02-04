import { NextRequest, NextResponse } from "next/server";
import { getAdminApiUrl } from "@/lib/admin-api";

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const token = _request.cookies.get("admin_token")?.value;

  if (!token) {
    return NextResponse.json({ detail: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  try {
    const res = await fetch(`${getAdminApiUrl()}/api/blog/posts/${id}/publish`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: "{}",
    });
    const data = await res.json();

    if (!res.ok) {
      return NextResponse.json(data || { detail: "Publish failed" }, { status: res.status });
    }

    return NextResponse.json(data);
  } catch (e) {
    console.error("Blog post publish proxy error:", e);
    return NextResponse.json(
      { detail: "Internal server error" },
      { status: 500 }
    );
  }
}
