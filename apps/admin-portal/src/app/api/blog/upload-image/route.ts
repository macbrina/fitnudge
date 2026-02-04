import { NextRequest, NextResponse } from "next/server";
import { getAdminApiUrl } from "@/lib/admin-api";

export async function POST(request: NextRequest) {
  const token = request.cookies.get("admin_token")?.value;

  if (!token) {
    return NextResponse.json({ detail: "Unauthorized" }, { status: 401 });
  }

  try {
    const formData = await request.formData();
    const res = await fetch(`${getAdminApiUrl()}/api/blog/upload-image`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        // Do NOT set Content-Type - fetch will set multipart/form-data with boundary
      },
      body: formData,
    });
    const data = await res.json();

    if (!res.ok) {
      return NextResponse.json(data || { detail: "Upload failed" }, { status: res.status });
    }

    return NextResponse.json(data);
  } catch (e) {
    console.error("Blog image upload proxy error:", e);
    return NextResponse.json(
      { detail: "Internal server error" },
      { status: 500 }
    );
  }
}
