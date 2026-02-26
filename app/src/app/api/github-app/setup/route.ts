import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import {
  verifyInstallState,
  createSetupToken,
  listInstallationRepos,
} from "@/lib/github-app";
import { createSupabaseAdmin } from "@/lib/supabase";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const installationIdParam = searchParams.get("installation_id");
  const state = searchParams.get("state");

  const userId = verifyInstallState(state);
  if (!userId) {
    return NextResponse.redirect(
      new URL("/api/auth/signin?callbackUrl=/onboarding", request.url).toString()
    );
  }

  const session = await auth();
  if (!session?.user) {
    return NextResponse.redirect(
      new URL("/api/auth/signin?callbackUrl=/onboarding", request.url).toString()
    );
  }

  const user = session.user as { userId?: string; username?: string };
  if (user.userId !== userId || !user.username) {
    return NextResponse.redirect(
      new URL("/api/auth/signin?callbackUrl=/onboarding", request.url).toString()
    );
  }

  const installationId = installationIdParam ? parseInt(installationIdParam, 10) : NaN;
  if (!Number.isInteger(installationId) || installationId <= 0) {
    return NextResponse.redirect(
      new URL("/onboarding?error=invalid_setup", request.url).toString()
    );
  }

  let repos: { name: string; full_name: string; html_url: string }[];
  try {
    repos = await listInstallationRepos(installationId);
  } catch {
    return NextResponse.redirect(
      new URL("/onboarding?error=github_app", request.url).toString()
    );
  }

  if (repos.length === 0) {
    return NextResponse.redirect(
      new URL("/onboarding?error=no_repos", request.url).toString()
    );
  }

  // Record this installation for the user so "available repos" works even if they skip adding to a project
  const supabase = createSupabaseAdmin();
  await supabase
    .from("user_connectors")
    .upsert(
      { user_id: userId, type: "github", external_id: String(installationId) },
      { onConflict: "user_id,type,external_id", ignoreDuplicates: true }
    );

  // Redirect to the repo picker; user can add repos to a project or skip
  const setupToken = createSetupToken(installationId);
  const base = new URL("/onboarding/github-app", request.url);
  base.searchParams.set("token", setupToken);
  return NextResponse.redirect(base.toString());
}
