import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { createSupabaseAdmin } from "@/lib/supabase";
import { TimezoneSelector } from "@/components/TimezoneSelector";

export default async function SettingsPage() {
  const session = await auth();
  if (!session?.user) {
    redirect("/api/auth/signin?callbackUrl=/settings");
  }

  const user = session.user as { userId?: string };
  if (!user.userId) redirect("/api/auth/signin?callbackUrl=/settings");

  const supabase = createSupabaseAdmin();
  const { data: userRow } = await supabase
    .from("users")
    .select("timezone")
    .eq("id", user.userId)
    .maybeSingle();
  const currentTimezone = userRow?.timezone ?? "UTC";

  return (
    <main className="mx-auto max-w-2xl px-4 py-8">
      <h1 className="mb-6 font-[family-name:var(--font-fraunces)] text-2xl font-semibold text-[#2a1f14]">
        Settings
      </h1>

      <section>
        <h2 className="mb-3 font-[family-name:var(--font-fraunces)] text-lg font-semibold text-[#2a1f14]">
          Timezone
        </h2>
        <p className="mb-3 text-sm text-[#78716c]">
          Used for activity dates and your profile activity heatmap.
        </p>
        <TimezoneSelector currentTimezone={currentTimezone} />
      </section>
    </main>
  );
}
