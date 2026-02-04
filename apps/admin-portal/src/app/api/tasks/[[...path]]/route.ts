import { NextRequest, NextResponse } from "next/server";
import { getAdminApiUrl } from "@/lib/admin-api";

/**
 * Proxy for Celery task monitoring endpoints.
 * Forwards GET/POST/DELETE to Admin API /api/tasks/*
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ path?: string[] }> }
) {
  const token = request.cookies.get("admin_token")?.value;

  if (!token) {
    return NextResponse.json({ detail: "Unauthorized" }, { status: 401 });
  }

  const { path = [] } = await params;
  const pathStr = path.length > 0 ? `/${path.join("/")}` : "";
  const { searchParams } = new URL(request.url);
  const query = searchParams.toString();

  try {
    const url = `${getAdminApiUrl()}/api/tasks${pathStr}${query ? `?${query}` : ""}`;
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await res.json();

    if (!res.ok) {
      return NextResponse.json(data || { detail: "Request failed" }, { status: res.status });
    }

    return NextResponse.json(data);
  } catch (e) {
    console.error("Tasks proxy error:", e);
    return NextResponse.json(
      { detail: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ path?: string[] }> }
) {
  const token = request.cookies.get("admin_token")?.value;

  if (!token) {
    return NextResponse.json({ detail: "Unauthorized" }, { status: 401 });
  }

  const { path = [] } = await params;
  const pathStr = path.length > 0 ? `/${path.join("/")}` : "";
  const { searchParams } = new URL(request.url);
  const query = searchParams.toString();

  try {
    const url = `${getAdminApiUrl()}/api/tasks${pathStr}${query ? `?${query}` : ""}`;
    const body = request.headers.get("content-length") ? await request.json().catch(() => ({})) : {};
    const res = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: Object.keys(body).length > 0 ? JSON.stringify(body) : undefined,
    });
    const data = await res.json();

    if (!res.ok) {
      return NextResponse.json(data || { detail: "Request failed" }, { status: res.status });
    }

    return NextResponse.json(data);
  } catch (e) {
    console.error("Tasks proxy error:", e);
    return NextResponse.json(
      { detail: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ path?: string[] }> }
) {
  const token = request.cookies.get("admin_token")?.value;

  if (!token) {
    return NextResponse.json({ detail: "Unauthorized" }, { status: 401 });
  }

  const { path = [] } = await params;
  const pathStr = path.length > 0 ? `/${path.join("/")}` : "";

  try {
    const url = `${getAdminApiUrl()}/api/tasks${pathStr}`;
    const res = await fetch(url, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await res.json();

    if (!res.ok) {
      return NextResponse.json(data || { detail: "Request failed" }, { status: res.status });
    }

    return NextResponse.json(data);
  } catch (e) {
    console.error("Tasks proxy error:", e);
    return NextResponse.json(
      { detail: "Internal server error" },
      { status: 500 }
    );
  }
}
