import { NextResponse } from "next/server";
import Parser from "rss-parser";
import { createSupabaseAdmin } from "@/lib/supabase";

const MAX_ITEMS_PER_SOURCE = 20;

type MediumItem = {
  title?: string;
  link?: string;
  guid?: string;
  pubDate?: string;
  "content:encoded"?: string;
  description?: string;
  creator?: string;
  categories?: string[];
};

const parser = new Parser<Record<string, unknown>, MediumItem>({
  customFields: {
    item: [
      ["content:encoded", "content:encoded"],
      ["dc:creator", "creator"],
    ],
  },
});

/** Strip HTML tags and return plain text. */
function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
}

/** Extract the first non-tracking image src from HTML content. */
function extractThumbnail(html: string): string | null {
  const imgRegex = /<img[^>]+src="([^"]+)"[^>]*(?:width="(\d+)"[^>]*height="(\d+)"|height="(\d+)"[^>]*width="(\d+)")?[^>]*>/gi;
  let match;
  while ((match = imgRegex.exec(html)) !== null) {
    const src = match[1];
    // Skip 1×1 tracking pixels or Medium stat URLs
    if (src.includes("/_/stat") || src.includes("medium.com/_/")) continue;
    const w = parseInt(match[2] ?? match[5] ?? "0", 10);
    const h = parseInt(match[3] ?? match[4] ?? "0", 10);
    if (w === 1 && h === 1) continue;
    return src;
  }
  return null;
}

/** Strip query string from a URL for stable idempotency key. */
function stripQuery(url: string): string {
  try {
    const u = new URL(url);
    u.search = "";
    return u.toString();
  } catch {
    return url;
  }
}

/** Derive display URL from external_id: @username → https://medium.com/@username, slug → https://medium.com/slug */
export function deriveMediumProfileUrl(externalId: string): string {
  return `https://medium.com/${externalId}`;
}

export async function GET(request: Request) {
  // Verify CRON_SECRET
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const auth = request.headers.get("authorization");
    if (auth !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  const supabase = createSupabaseAdmin();

  // Fetch all active Medium sources with their project and user info
  const { data: sources, error: sourcesError } = await supabase
    .from("project_connector_sources")
    .select(
      `id, external_id, url, connector_type,
       projects!inner(id, user_id, users!projects_user_id_fkey!inner(id, timezone))`
    )
    .eq("connector_type", "medium")
    .eq("active", true);

  if (sourcesError) {
    console.error("[ingest-medium] failed to fetch sources", sourcesError);
    return NextResponse.json({ error: "Failed to fetch sources" }, { status: 500 });
  }

  const results: Array<{ sourceId: string; inserted: number; skipped: number; error?: string }> = [];

  for (const source of sources ?? []) {
    const project = source.projects as Record<string, unknown>;
    const projectId = project.id as string;
    const userId = project.user_id as string;
    const users = project.users as Record<string, unknown>;
    const timezone = (users.timezone as string) || "UTC";

    if (!source.url) {
      results.push({ sourceId: source.id, inserted: 0, skipped: 0, error: "No URL" });
      continue;
    }

    try {
      const feed = await parser.parseURL(source.url);
      const items = (feed.items ?? []).slice(0, MAX_ITEMS_PER_SOURCE);

      let inserted = 0;
      let skipped = 0;

      for (const item of items) {
        const rawLink = item.link ?? item.guid ?? "";
        const articleUrl = stripQuery(rawLink) || item.guid || rawLink;

        if (!articleUrl) {
          skipped++;
          continue;
        }

        // Idempotency check
        const { data: existing } = await supabase
          .from("activities")
          .select("id")
          .eq("connector_source_id", source.id)
          .eq("connector_metadata->>article_url", articleUrl)
          .maybeSingle();

        if (existing) {
          skipped++;
          continue;
        }

        // Parse published date
        const publishedDate = item.pubDate ? new Date(item.pubDate) : new Date();
        const dateUtc = publishedDate.toISOString().slice(0, 10);

        // Derive local date from user's timezone
        let dateLocal = dateUtc;
        try {
          dateLocal = new Intl.DateTimeFormat("en-CA", {
            timeZone: timezone,
            year: "numeric",
            month: "2-digit",
            day: "2-digit",
          }).format(publishedDate);
        } catch {
          dateLocal = dateUtc;
        }

        const contentHtml = item["content:encoded"] ?? item.description ?? "";

        // Extract thumbnail (skip tracking pixels)
        const thumbnailUrl = contentHtml ? extractThumbnail(contentHtml) : null;

        // Extract text snippet (~200 chars)
        const snippet = contentHtml
          ? stripHtml(contentHtml).slice(0, 200) || null
          : null;

        const connectorMetadata = {
          article_url: articleUrl,
          title: item.title ?? null,
          published_at: publishedDate.toISOString(),
          thumbnail_url: thumbnailUrl,
          snippet,
          guid: item.guid ?? null,
          author: item.creator ?? null,
          categories: item.categories ?? [],
        };

        const { error: insertError } = await supabase.from("activities").insert({
          type: "auto_medium",
          connector_source_id: source.id,
          project_id: projectId,
          user_id: userId,
          date_utc: dateUtc,
          date_local: dateLocal,
          content_text: snippet,
          content_image_url: thumbnailUrl,
          connector_metadata: connectorMetadata,
          last_commit_at: publishedDate.toISOString(),
        });

        if (insertError) {
          console.error("[ingest-medium] insert failed", { insertError, sourceId: source.id, articleUrl });
          skipped++;
        } else {
          inserted++;
        }
      }

      results.push({ sourceId: source.id, inserted, skipped });
    } catch (err) {
      console.error("[ingest-medium] fetch/parse failed", { sourceId: source.id, url: source.url, err });
      results.push({ sourceId: source.id, inserted: 0, skipped: 0, error: String(err) });
    }
  }

  return NextResponse.json({ ok: true, results });
}
