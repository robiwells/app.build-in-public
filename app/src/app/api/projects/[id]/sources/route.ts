import { NextResponse } from "next/server";
import Parser from "rss-parser";
import { auth } from "@/lib/auth";
import { addConnectorSource } from "@/lib/projects";

const parser = new Parser();

/** Build RSS feed URL from external_id (@username or publication-slug). */
function buildRssUrl(externalId: string): string {
  return `https://medium.com/feed/${externalId}`;
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  }

  const user = session.user as { userId?: string };
  if (!user.userId) {
    return NextResponse.json({ error: "User not found" }, { status: 400 });
  }

  const { id: projectId } = await params;

  let body: { connector_type?: string; external_id?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const connectorType = body.connector_type?.trim() ?? "";
  const externalId = body.external_id?.trim() ?? "";

  if (!connectorType || !externalId) {
    return NextResponse.json({ error: "connector_type and external_id are required" }, { status: 400 });
  }

  if (connectorType !== "medium") {
    return NextResponse.json({ error: "Unsupported connector_type" }, { status: 400 });
  }

  // Validate external_id format
  if (!/^@?[a-zA-Z0-9_-]+$/.test(externalId)) {
    return NextResponse.json({ error: "Invalid username or publication slug" }, { status: 400 });
  }

  const rssUrl = buildRssUrl(externalId);

  // Pre-flight: validate feed
  let displayName: string | null = null;
  try {
    const feed = await parser.parseURL(rssUrl);
    displayName = feed.title ?? externalId;
  } catch {
    return NextResponse.json({ error: "Feed not found or invalid. Check the username or slug." }, { status: 422 });
  }

  const { sourceId, error } = await addConnectorSource(projectId, user.userId, {
    connectorType,
    externalId,
    url: rssUrl,
    displayName,
  });

  if (error) {
    return NextResponse.json({ error }, { status: error === "Project not found" ? 404 : 409 });
  }

  return NextResponse.json({ ok: true, sourceId }, { status: 201 });
}
