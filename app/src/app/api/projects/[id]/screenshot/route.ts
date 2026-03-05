import { NextResponse } from "next/server";
import { createSupabaseAdmin } from "@/lib/supabase";

const PAGESHOT_BASE = "https://pageshot.site/v1/screenshot";
const SCREENSHOT_VIEWPORT = { width: 1280, height: 800 };

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: projectId } = await params;
  const supabase = createSupabaseAdmin();

  const { data: project, error } = await supabase
    .from("projects")
    .select("id, url, screenshot_url")
    .eq("id", projectId)
    .eq("active", true)
    .maybeSingle();

  if (error || !project) {
    return new NextResponse(null, { status: 404 });
  }

  if (project.screenshot_url) {
    return NextResponse.redirect(project.screenshot_url);
  }

  const url = (project as { url?: string | null }).url;
  if (!url || !url.startsWith("http")) {
    return new NextResponse(null, { status: 404 });
  }

  try {
    const screenshotUrl = `${PAGESHOT_BASE}?${new URLSearchParams({
      url,
      width: String(SCREENSHOT_VIEWPORT.width),
      height: String(SCREENSHOT_VIEWPORT.height),
      format: "webp",
    })}`;
    const res = await fetch(screenshotUrl, { signal: AbortSignal.timeout(15000) });
    if (!res.ok) {
      console.error("[screenshot] PageShot failed", res.status, projectId);
      return new NextResponse(null, { status: 502 });
    }
    const buffer = Buffer.from(await res.arrayBuffer());
    const path = `project-screenshots/${projectId}.webp`;

    const { error: uploadErr } = await supabase.storage
      .from("activity_images")
      .upload(path, buffer, { contentType: "image/webp", upsert: true });

    if (uploadErr) {
      console.error("[screenshot] upload error", uploadErr, projectId);
      return new NextResponse(null, { status: 500 });
    }

    const { data: urlData } = supabase.storage
      .from("activity_images")
      .getPublicUrl(path);

    await supabase
      .from("projects")
      .update({ screenshot_url: urlData.publicUrl, updated_at: new Date().toISOString() })
      .eq("id", projectId);

    return NextResponse.redirect(urlData.publicUrl);
  } catch (err) {
    console.error("[screenshot] capture error", err, projectId);
    return new NextResponse(null, { status: 502 });
  }
}
