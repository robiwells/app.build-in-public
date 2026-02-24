import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { createSupabaseAdmin } from "@/lib/supabase";

const MAX_SIZE_BYTES = 5 * 1024 * 1024; // 5MB
const ALLOWED_TYPES = ["image/jpeg", "image/webp", "image/png"];

export async function POST(req: NextRequest) {
  const session = await auth();
  const sessionUser = session?.user as { userId?: string } | undefined;
  if (!sessionUser?.userId) {
    return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  }
  const userId = sessionUser.userId;

  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return NextResponse.json({ error: "Invalid form data" }, { status: 400 });
  }

  const file = formData.get("file");
  if (!file || !(file instanceof File)) {
    return NextResponse.json({ error: "Missing or invalid file" }, { status: 400 });
  }

  if (!ALLOWED_TYPES.includes(file.type)) {
    return NextResponse.json({ error: "Invalid file type" }, { status: 400 });
  }
  if (file.size > MAX_SIZE_BYTES) {
    return NextResponse.json({ error: "File too large" }, { status: 400 });
  }

  const supabase = createSupabaseAdmin();
  const ext = file.type === "image/webp" ? "webp" : file.type === "image/png" ? "png" : "jpg";
  const path = `${userId}/${crypto.randomUUID()}.${ext}`;

  const { error: uploadError } = await supabase.storage
    .from("activity_images")
    .upload(path, file, { contentType: file.type, upsert: false });

  if (uploadError) {
    console.error("[upload] storage error", uploadError);
    return NextResponse.json({ error: uploadError.message }, { status: 500 });
  }

  const { data } = supabase.storage.from("activity_images").getPublicUrl(path);
  return NextResponse.json({ url: data.publicUrl });
}
