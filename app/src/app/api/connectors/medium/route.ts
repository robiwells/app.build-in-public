import { NextResponse } from "next/server";
import Parser from "rss-parser";
import { auth } from "@/lib/auth";
import { createSupabaseAdmin } from "@/lib/supabase";

const parser = new Parser();

/** Normalise input: trim, ensure profile slugs keep their @ prefix. */
function normalise(input: string): string {
  const trimmed = input.trim();
  // If it looks like a username without @, add it only if no slash (not a publication path)
  return trimmed;
}

/** Build RSS feed URL from normalised external_id. */
export function buildRssUrl(externalId: string): string {
  const id = externalId.startsWith("@") ? externalId : externalId;
  return `https://medium.com/feed/${id}`;
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  }

  const user = session.user as { userId?: string };
  if (!user.userId) {
    return NextResponse.json({ error: "User not found" }, { status: 400 });
  }

  let body: { external_id?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const raw = body.external_id?.trim() ?? "";
  if (!raw) {
    return NextResponse.json({ error: "external_id is required" }, { status: 400 });
  }

  // Validate: allow @username or publication-slug (letters, numbers, hyphens, underscores, optional leading @)
  if (!/^@?[a-zA-Z0-9_-]+$/.test(raw)) {
    return NextResponse.json({ error: "Invalid username or publication slug" }, { status: 400 });
  }

  const externalId = normalise(raw);
  const rssUrl = buildRssUrl(externalId);

  // Pre-flight: fetch and parse the RSS feed
  let displayName: string | null = null;
  let latestTitle: string | null = null;
  try {
    const feed = await parser.parseURL(rssUrl);
    displayName = feed.title ?? null;
    latestTitle = feed.items?.[0]?.title ?? null;
  } catch {
    return NextResponse.json({ error: "Feed not found or invalid. Check the username or slug." }, { status: 422 });
  }

  // Upsert user_connectors row
  const supabase = createSupabaseAdmin();
  const { error: upsertError } = await supabase
    .from("user_connectors")
    .upsert(
      {
        user_id: user.userId,
        type: "medium",
        external_id: externalId,
        display_name: displayName,
      },
      { onConflict: "user_id,type,external_id" }
    );

  if (upsertError) {
    console.error("[connectors/medium] upsert failed", upsertError);
    return NextResponse.json({ error: "Failed to save connector" }, { status: 500 });
  }

  const { data: row } = await supabase
    .from("user_connectors")
    .select("id")
    .eq("user_id", user.userId)
    .eq("type", "medium")
    .eq("external_id", externalId)
    .maybeSingle();

  return NextResponse.json({
    ok: true,
    id: row?.id ?? null,
    external_id: externalId,
    display_name: displayName,
    latest_title: latestTitle,
  });
}

/** Remove (deactivate) one Medium connector by id. Verifies ownership. */
export async function DELETE(request: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  }

  const user = session.user as { userId?: string };
  if (!user.userId) {
    return NextResponse.json({ error: "User not found" }, { status: 400 });
  }

  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id")?.trim();
  if (!id) {
    return NextResponse.json({ error: "id is required" }, { status: 400 });
  }

  const supabase = createSupabaseAdmin();
  const { data: connector } = await supabase
    .from("user_connectors")
    .select("id")
    .eq("id", id)
    .eq("user_id", user.userId)
    .eq("type", "medium")
    .eq("active", true)
    .maybeSingle();

  if (!connector) {
    return NextResponse.json({ error: "Connector not found" }, { status: 404 });
  }

  const { error: connectorError } = await supabase
    .from("user_connectors")
    .update({ active: false })
    .eq("id", connector.id);

  if (connectorError) {
    console.error("[connectors/medium] DELETE deactivate failed", connectorError);
    return NextResponse.json({ error: "Failed to remove connector" }, { status: 500 });
  }

  await supabase
    .from("project_connector_sources")
    .update({ active: false, updated_at: new Date().toISOString() })
    .eq("user_connector_id", connector.id);

  return NextResponse.json({ ok: true });
}
