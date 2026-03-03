import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { createSupabaseAdmin } from "@/lib/supabase";
import { getNotionClient } from "@/lib/notion";

type NotionPageResult = {
  id: string;
  title: string;
  icon: string | null;
  url: string;
};

function extractTitle(page: Record<string, unknown>): string {
  const props = page.properties as Record<string, unknown> | undefined;
  if (props) {
    for (const prop of Object.values(props)) {
      const p = prop as Record<string, unknown>;
      if (p.type === "title") {
        const titleArr = p.title as Array<{ plain_text: string }> | undefined;
        return titleArr?.map((t) => t.plain_text).join("") ?? "Untitled";
      }
    }
  }
  return "Untitled";
}

function extractIcon(page: Record<string, unknown>): string | null {
  const icon = page.icon as Record<string, unknown> | null | undefined;
  if (!icon) return null;
  if (icon.type === "emoji") return icon.emoji as string;
  return null;
}

/** GET /api/connectors/notion/pages — search workspace pages for picker. */
export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  }

  const user = session.user as { userId?: string };
  if (!user.userId) {
    return NextResponse.json({ error: "User not found" }, { status: 400 });
  }

  const supabase = createSupabaseAdmin();

  // Get user's active Notion connector (cast via any — access_token added by migration)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabaseAny = supabase as any;
  const { data: connector } = await supabaseAny
    .from("user_connectors")
    .select("id, access_token")
    .eq("user_id", user.userId)
    .eq("type", "notion")
    .eq("active", true)
    .maybeSingle();

  if (!connector) {
    return NextResponse.json({ error: "No active Notion connector found" }, { status: 404 });
  }

  const accessToken = (connector as Record<string, unknown>).access_token as string | null;
  if (!accessToken) {
    return NextResponse.json({ error: "Notion connector missing access token" }, { status: 400 });
  }

  try {
    const client = getNotionClient(accessToken);
    const response = await client.search({
      filter: { value: "page", property: "object" },
      page_size: 50,
    });

    const pages: NotionPageResult[] = response.results
      .filter((r) => (r as Record<string, unknown>).object === "page")
      .map((r) => {
        const page = r as Record<string, unknown>;
        return {
          id: page.id as string,
          title: extractTitle(page),
          icon: extractIcon(page),
          url: page.url as string,
        };
      });

    return NextResponse.json({ pages });
  } catch (err) {
    console.error("[GET /api/connectors/notion/pages] Notion API error:", err);
    return NextResponse.json({ error: "Failed to fetch pages from Notion" }, { status: 500 });
  }
}
