import { NextRequest, NextResponse } from "next/server";
import { getAdminApiUrl } from "@/lib/admin-api";

async function proxy(
  request: NextRequest,
  method: "GET" | "POST" | "PUT" | "DELETE",
  pathSegments: string[]
) {
  const token = request.cookies.get("admin_token")?.value;

  if (!token) {
    return NextResponse.json({ detail: "Unauthorized" }, { status: 401 });
  }

  const pathStr = pathSegments.length > 0 ? `/${pathSegments.join("/")}` : "";
  const { searchParams } = new URL(request.url);
  const query = searchParams.toString();
  const url = `${getAdminApiUrl()}/api/plan-features${pathStr}${query ? `?${query}` : ""}`;

  try {
    const options: RequestInit = {
      method,
      headers: { Authorization: `Bearer ${token}` },
    };
    if ((method === "POST" || method === "PUT") && request.body) {
      options.body = await request.text();
      (options.headers as Record<string, string>)["Content-Type"] =
        "application/json";
    }

    const res = await fetch(url, options);
    const data = await res.json();

    if (!res.ok) {
      return NextResponse.json(data || { detail: "Request failed" }, {
        status: res.status,
      });
    }

    return NextResponse.json(data);
  } catch (e) {
    console.error("Plan features proxy error:", e);
    return NextResponse.json(
      { detail: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ path?: string[] }> }
) {
  const { path = [] } = await params;
  return proxy(request, "GET", path);
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ path?: string[] }> }
) {
  const { path = [] } = await params;
  if (path.length === 0) {
    return NextResponse.json(
      { detail: "Feature ID required for update" },
      { status: 400 }
    );
  }
  return proxy(request, "PUT", path);
}
