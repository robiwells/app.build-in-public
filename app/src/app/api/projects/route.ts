import { auth } from "@/lib/auth";
import { createSupabaseAdmin } from "@/lib/supabase";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = session.user as { userId?: string };
  if (!user.userId) {
    return NextResponse.json({ error: "User not found" }, { status: 400 });
  }

  let body: { repo_full_name?: string; repo_url?: string; installation_id?: number };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { repo_full_name, repo_url, installation_id } = body;
  if (!repo_full_name || !repo_url) {
    return NextResponse.json(
      { error: "repo_full_name and repo_url required" },
      { status: 400 }
    );
  }
  if (installation_id == null || typeof installation_id !== "number") {
    return NextResponse.json(
      { error: "installation_id required (connect via GitHub App)" },
      { status: 400 }
    );
  }

  const supabase = createSupabaseAdmin();
  const { data: existing } = await supabase
    .from("projects")
    .select("id")
    .eq("user_id", user.userId)
    .maybeSingle();

  if (existing) {
    const { error } = await supabase
      .from("projects")
      .update({
        active: true,
        repo_full_name,
        repo_url,
        installation_id,
        updated_at: new Date().toISOString(),
      })
      .eq("id", existing.id);
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
  } else {
    const { error } = await supabase.from("projects").insert({
      user_id: user.userId,
      repo_full_name,
      repo_url,
      installation_id,
    });
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
  }

  return NextResponse.json({ ok: true });
}
