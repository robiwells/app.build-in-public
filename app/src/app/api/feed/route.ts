import { queryFeed } from "@/lib/feed";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const limit = Math.min(Number(searchParams.get("limit")) || 20, 100);
  const cursor = searchParams.get("cursor");
  const category = searchParams.get("category");

  const { feed, nextCursor, dbError } = await queryFeed({ cursor, category, limit });

  if (dbError) {
    console.error("GET /api/feed error:", dbError);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }

  return NextResponse.json({ feed, nextCursor });
}
