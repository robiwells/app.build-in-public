import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { createSupabaseAdmin } from "@/lib/supabase";
import { buildNotionAuthUrl } from "@/lib/notion";

/** GET — return the Notion OAuth authorisation URL for the current user. */
export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  }

  const user = session.user as { userId?: string };
  if (!user.userId) {
    return NextResponse.json({ error: "User not found" }, { status: 400 });
  }

  try {
    const url = buildNotionAuthUrl(user.userId);
    return NextResponse.json({ url });
  } catch (err) {
    console.error("[GET /api/connectors/notion] buildNotionAuthUrl failed:", err);
    return NextResponse.json({ error: "OAuth configuration error" }, { status: 500 });
  }
}

/** DELETE — deactivate the Notion connector and all linked project sources. */
export async function DELETE(request: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  }

  const user = session.user as { userId?: string };
  if (!user.userId) {
    return NextResponse.json({ error: "User not found" }, { status: 400 });
  }

  let body: { id?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { id } = body;
  if (!id) {
    return NextResponse.json({ error: "id is required" }, { status: 400 });
  }

  const supabase = createSupabaseAdmin();

  const { data: connector } = await supabase
    .from("user_connectors")
    .select("id")
    .eq("id", id)
    .eq("user_id", user.userId)
    .eq("type", "notion")
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
    console.error("[DELETE /api/connectors/notion] deactivate failed:", connectorError);
    return NextResponse.json({ error: "Failed to remove connector" }, { status: 500 });
  }

  // Deactivate all linked project sources
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (supabase as any)
    .from("project_connector_sources")
    .update({ active: false, updated_at: new Date().toISOString() })
    .eq("user_connector_id", connector.id);

  return NextResponse.json({ ok: true });
}
