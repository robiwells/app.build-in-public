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
  const deliveryId = request.headers.get("x-github-delivery");

  if (deliveryId) {
    const supabase = createSupabaseAdmin();
    const { error: insertError } = await supabase
      .from("webhook_events")
      .insert({ delivery_id: deliveryId, event_type: event ?? "unknown" });
    if (insertError) {
      if (insertError.code === "23505") {
        return NextResponse.json({ ok: true, duplicate: true });
      }
      console.error("[webhook] delivery_id insert failed", { error: insertError, deliveryId, event });
    }
  }

  if (event === "push") {
    await processPushEvent(payload, deliveryId ?? undefined);
  } else if (event === "installation") {
    const body = payload as { action?: string; installation?: { id?: number } };
    if (body.action === "deleted" && typeof body.installation?.id === "number") {
      const supabase = createSupabaseAdmin();
      const installationIdStr = String(body.installation.id);
      // Deactivate the user_connector and all its project sources
      const { data: connector } = await supabase
        .from("user_connectors")
        .select("id")
        .eq("type", "github")
        .eq("external_id", installationIdStr)
        .maybeSingle();
      if (connector) {
        const { error: connectorError } = await supabase
          .from("user_connectors")
          .update({ active: false })
          .eq("id", connector.id);
        if (connectorError) {
          console.error("[webhook] connector deactivation failed", { error: connectorError, installationId: body.installation.id, deliveryId });
        }
        const { error: sourcesError } = await supabase
          .from("project_connector_sources")
          .update({ active: false, updated_at: new Date().toISOString() })
          .eq("user_connector_id", connector.id);
        if (sourcesError) {
          console.error("[webhook] connector sources deactivation failed", { error: sourcesError, installationId: body.installation.id, deliveryId });
        }
      }
    }
  }

  return NextResponse.json({ ok: true });
}
