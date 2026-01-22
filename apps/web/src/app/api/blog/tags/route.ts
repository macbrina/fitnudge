import { getServerClient } from "@/lib/supabase";
import { NextResponse } from "next/server";

export async function GET() {
  const supabase = getServerClient();

  if (!supabase) {
    return NextResponse.json(
      { error: "Database not configured" },
      { status: 503 },
    );
  }

  try {
    const { data, error } = await supabase
      .from("blog_tags")
      .select("*")
      .order("name");

    if (error) {
      return NextResponse.json(
        { error: "Failed to fetch tags" },
        { status: 500 },
      );
    }

    return NextResponse.json(data || []);
  } catch {
    return NextResponse.json(
      { error: "Failed to fetch tags" },
      { status: 500 },
    );
  }
}
