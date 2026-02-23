import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";

export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const token = (session as { accessToken?: string }).accessToken;
  if (!token) {
    return NextResponse.json(
      { error: "No GitHub access token; re-sign in" },
      { status: 400 }
    );
  }

  const res = await fetch("https://api.github.com/user/repos?per_page=100&sort=updated", {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    const text = await res.text();
    return NextResponse.json(
      { error: "GitHub API error", details: text },
      { status: res.status }
    );
  }

  const repos = await res.json();
  const publicRepos = (repos as { private?: boolean; full_name?: string; html_url?: string; name?: string }[])
    .filter((r) => !r.private)
    .map((r) => ({
      name: r.name,
      full_name: r.full_name,
      html_url: r.html_url,
    }));

  return NextResponse.json(publicRepos);
}
