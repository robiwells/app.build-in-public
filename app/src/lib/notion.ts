import { Client } from "@notionhq/client";
import { createHmac } from "crypto";

export type NotionAnnotations = {
  bold: boolean;
  italic: boolean;
  strikethrough: boolean;
  underline: boolean;
  code: boolean;
  color: string;
};

export type NotionRichText = {
  plain_text: string;
  href: string | null;
  annotations: NotionAnnotations;
};

export type NotionBlock = {
  id: string;
  type: string;
  has_children: boolean;
  [key: string]: unknown;
  children?: NotionBlock[];
};

export type NotionPageMeta = {
  id: string;
  title: string;
  icon: string | null;
  url: string;
  last_edited_time: string;
};

export function getNotionClient(accessToken: string): Client {
  return new Client({ auth: accessToken });
}

/** Extract plain title from a Notion page object. */
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

/** Extract emoji icon from page, or null. */
function extractIcon(page: Record<string, unknown>): string | null {
  const icon = page.icon as Record<string, unknown> | null | undefined;
  if (!icon) return null;
  if (icon.type === "emoji") return icon.emoji as string;
  return null;
}

export async function fetchPageMeta(
  client: Client,
  pageId: string
): Promise<NotionPageMeta> {
  const page = (await client.pages.retrieve({ page_id: pageId })) as Record<string, unknown>;
  return {
    id: page.id as string,
    title: extractTitle(page),
    icon: extractIcon(page),
    url: page.url as string,
    last_edited_time: page.last_edited_time as string,
  };
}

/** Fetch all blocks for a page, plus one level of children for has_children blocks. */
export async function fetchPageBlocks(
  client: Client,
  pageId: string
): Promise<NotionBlock[]> {
  const blocks: NotionBlock[] = [];

  let cursor: string | undefined;
  do {
    const response = await client.blocks.children.list({
      block_id: pageId,
      page_size: 100,
      ...(cursor ? { start_cursor: cursor } : {}),
    });

    for (const block of response.results) {
      const b = block as NotionBlock;
      if (b.has_children) {
        try {
          b.children = await fetchPageBlocks(client, b.id);
        } catch {
          b.children = [];
        }
      }
      blocks.push(b);
    }

    cursor = response.next_cursor ?? undefined;
  } while (cursor);

  return blocks;
}

/** Build Notion OAuth URL with HMAC-signed state param. */
export function buildNotionAuthUrl(userId: string): string {
  const clientId = process.env.NOTION_CLIENT_ID;
  const clientSecret = process.env.NOTION_CLIENT_SECRET;
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL;

  if (!clientId || !clientSecret || !baseUrl) {
    throw new Error("Missing Notion OAuth environment variables");
  }

  const payload = JSON.stringify({ userId, ts: Date.now() });
  const sig = createHmac("sha256", clientSecret)
    .update(payload)
    .digest("hex");
  const state = Buffer.from(payload).toString("base64url") + "." + sig;

  const redirectUri = `${baseUrl}/api/connectors/notion/callback`;

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    owner: "user",
    state,
  });

  return `https://api.notion.com/v1/oauth/authorize?${params.toString()}`;
}

/** Verify signed state and return userId, or throw. */
export function verifyNotionState(state: string): string {
  const clientSecret = process.env.NOTION_CLIENT_SECRET;
  if (!clientSecret) throw new Error("Missing NOTION_CLIENT_SECRET");

  const dotIdx = state.lastIndexOf(".");
  if (dotIdx === -1) throw new Error("Invalid state format");

  const encodedPayload = state.slice(0, dotIdx);
  const sig = state.slice(dotIdx + 1);

  let payload: string;
  try {
    payload = Buffer.from(encodedPayload, "base64url").toString("utf-8");
  } catch {
    throw new Error("Invalid state encoding");
  }

  const expectedSig = createHmac("sha256", clientSecret)
    .update(payload)
    .digest("hex");

  if (sig !== expectedSig) throw new Error("Invalid state signature");

  const parsed = JSON.parse(payload) as { userId: string; ts: number };

  // Reject states older than 10 minutes
  if (Date.now() - parsed.ts > 10 * 60 * 1000) {
    throw new Error("State expired");
  }

  return parsed.userId;
}
