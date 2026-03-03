import { NextResponse } from "next/server";
import { createSupabaseAdmin } from "@/lib/supabase";
import { verifyNotionState } from "@/lib/notion";

const NOTION_TOKEN_URL = "https://api.notion.com/v1/oauth/token";

type NotionTokenResponse = {
  access_token: string;
  workspace_id: string;
  workspace_name: string | null;
  bot_id: string;
};

/** GET /api/connectors/notion/callback — OAuth callback from Notion. */
export async function GET(request: Request) {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL ?? "";
  const { searchParams } = new URL(request.url);

  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const error = searchParams.get("error");

  if (error) {
    return NextResponse.redirect(`${baseUrl}/connectors?notion=denied`);
  }

  if (!code || !state) {
    return NextResponse.redirect(`${baseUrl}/connectors?notion=invalid`);
  }

  let userId: string;
  try {
    userId = verifyNotionState(state);
  } catch (err) {
    console.error("[notion/callback] state verification failed:", err);
    return NextResponse.redirect(`${baseUrl}/connectors?notion=invalid`);
  }

  const clientId = process.env.NOTION_CLIENT_ID;
  const clientSecret = process.env.NOTION_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    console.error("[notion/callback] missing Notion credentials");
    return NextResponse.redirect(`${baseUrl}/connectors?notion=error`);
  }

  const redirectUri = `${baseUrl}/api/connectors/notion/callback`;

  let tokenData: NotionTokenResponse;
  try {
    const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");
    const res = await fetch(NOTION_TOKEN_URL, {
      method: "POST",
      headers: {
        "Authorization": `Basic ${credentials}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        grant_type: "authorization_code",
        code,
        redirect_uri: redirectUri,
      }),
    });

    if (!res.ok) {
      const errBody = await res.text();
      console.error("[notion/callback] token exchange failed:", res.status, errBody);
      return NextResponse.redirect(`${baseUrl}/connectors?notion=error`);
    }

    tokenData = await res.json() as NotionTokenResponse;
  } catch (err) {
    console.error("[notion/callback] token exchange error:", err);
    return NextResponse.redirect(`${baseUrl}/connectors?notion=error`);
  }

  const supabase = createSupabaseAdmin();
  const { error: upsertError } = await supabase
    .from("user_connectors")
    .upsert(
      {
        user_id: userId,
        type: "notion",
        external_id: tokenData.workspace_id,
        display_name: tokenData.workspace_name ?? "Notion workspace",
        access_token: tokenData.access_token,
        active: true,
      },
      { onConflict: "user_id,type,external_id" }
    );

  if (upsertError) {
    console.error("[notion/callback] upsert failed:", upsertError);
    return NextResponse.redirect(`${baseUrl}/connectors?notion=error`);
  }

  return NextResponse.redirect(`${baseUrl}/connectors?notion=connected`);
}
