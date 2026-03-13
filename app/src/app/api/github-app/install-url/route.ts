import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { createInstallState } from "@/lib/github-app";

export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  }

  const user = session.user as { userId?: string };
  if (!user.userId) {
    return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  }

  const slug = process.env.GITHUB_APP_SLUG;
  if (!slug) {
    return NextResponse.json({ url: null });
  }

  const state = createInstallState(user.userId);
  const url = `https://github.com/apps/${slug}/installations/new?state=${state}`;
  return NextResponse.json({ url });
}
