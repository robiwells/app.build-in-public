import { auth } from "@/lib/auth";
import { createSupabaseAdmin } from "@/lib/supabase";
import { NextResponse } from "next/server";

export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = session.user as { userId?: string };
  if (!user.userId) {
    return NextResponse.json({ error: "User not found" }, { status: 400 });
  }

  const supabase = createSupabaseAdmin();
  const { data: project, error } = await supabase
    .from("projects")
    .select("id, repo_full_name, repo_url")
    .eq("user_id", user.userId)
    .eq("active", true)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (!project) {
    return NextResponse.json({ project: null });
  }

  return NextResponse.json({
    project: {
      repo_full_name: project.repo_full_name,
      repo_url: project.repo_url,
    },
  });
}

export async function PATCH(request: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = session.user as { userId?: string };
  if (!user.userId) {
    return NextResponse.json({ error: "User not found" }, { status: 400 });
  }

  let body: { repo_full_name?: string; repo_url?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { repo_full_name, repo_url } = body;
  if (!repo_full_name || !repo_url) {
    return NextResponse.json(
      { error: "repo_full_name and repo_url required" },
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
        repo_full_name,
        repo_url,
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
    });
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
  }

  return NextResponse.json({
    project: { repo_full_name, repo_url },
  });
}
