import { NextRequest, NextResponse } from "next/server";
import { getAdminApiUrl } from "@/lib/admin-api";

/**
 * Proxy for app-config endpoints.
 * GET /api/app-config -> list all
 * GET /api/app-config/{key} -> get single
 * PUT /api/app-config/{key} -> update
 */
async function proxy(
  request: NextRequest,
  method: "GET" | "PUT",
  pathSegments: string[]
) {
  const token = request.cookies.get("admin_token")?.value;

  if (!token) {
    return NextResponse.json({ detail: "Unauthorized" }, { status: 401 });
  }

  const pathStr = pathSegments.length > 0 ? `/${pathSegments.join("/")}` : "";
  const url = `${getAdminApiUrl()}/api/app-config${pathStr}`;

  try {
    const options: RequestInit = {
      method,
      headers: { Authorization: `Bearer ${token}` },
    };
    if (method === "PUT" && request.body) {
      options.body = await request.text();
      options.headers = {
        ...options.headers,
        "Content-Type": "application/json",
      } as HeadersInit;
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
    console.error("App config proxy error:", e);
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
      { detail: "Key required for update" },
      { status: 400 }
    );
  }
  return proxy(request, "PUT", path);
}
