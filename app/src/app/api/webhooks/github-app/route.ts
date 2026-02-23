import { createHmac, timingSafeEqual } from "crypto";
import { NextResponse } from "next/server";
import { processPushEvent } from "@/lib/activity";
import { createSupabaseAdmin } from "@/lib/supabase";

const WEBHOOK_SECRET = process.env.GITHUB_APP_WEBHOOK_SECRET ?? "";

function verifySignature(rawBody: string, signature: string | null): boolean {
  if (!WEBHOOK_SECRET || !signature?.startsWith("sha256=")) return false;
  const expected = createHmac("sha256", WEBHOOK_SECRET)
    .update(rawBody, "utf8")
    .digest("hex");
  const actual = signature.slice(7);
  if (expected.length !== actual.length) return false;
  try {
    return timingSafeEqual(Buffer.from(expected, "hex"), Buffer.from(actual, "hex"));
  } catch {
    return false;
  }
}

export async function POST(request: Request) {
  const rawBody = await request.text();
  const signature = request.headers.get("x-hub-signature-256");

  if (!verifySignature(rawBody, signature)) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  let payload: unknown;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const event = request.headers.get("x-github-event");

  if (event === "push") {
    await processPushEvent(payload);
  } else if (event === "installation") {
    const body = payload as { action?: string; installation?: { id?: number } };
    if (body.action === "deleted" && typeof body.installation?.id === "number") {
      const supabase = createSupabaseAdmin();
      await supabase
        .from("projects")
        .update({ active: false, updated_at: new Date().toISOString() })
        .eq("installation_id", body.installation.id);
    }
  }

  return NextResponse.json({ ok: true });
}
