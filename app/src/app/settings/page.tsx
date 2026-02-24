import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { createInstallState } from "@/lib/github-app";
import { createSupabaseAdmin } from "@/lib/supabase";
import { TimezoneSelector } from "@/components/TimezoneSelector";

export default async function SettingsPage() {
  const session = await auth();
  if (!session?.user) {
    redirect("/api/auth/signin?callbackUrl=/settings");
  }

  const user = session.user as { userId?: string; username?: string };
  if (!user.userId) redirect("/api/auth/signin?callbackUrl=/settings");

  const appSlug = process.env.GITHUB_APP_SLUG;
  const installAppUrl =
    appSlug && user.userId
      ? `https://github.com/apps/${appSlug}/installations/new?state=${encodeURIComponent(createInstallState(user.userId))}`
      : null;

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

      {installAppUrl && (
        <section className="mb-8">
          <h2 className="mb-3 font-[family-name:var(--font-fraunces)] text-lg font-semibold text-[#2a1f14]">
            Connectors
          </h2>
          <a
            href={installAppUrl}
            className="inline-block rounded-full bg-[#b5522a] px-4 py-2 text-sm font-medium text-white hover:bg-[#9a4522]"
          >
            GitHub
          </a>
          <p className="mt-2 text-sm text-[#78716c]">
            Install or reconfigure the connectors to automatically track progress across your projects.
          </p>
        </section>
      )}

      <section>
        <h2 className="mb-3 font-[family-name:var(--font-fraunces)] text-lg font-semibold text-[#2a1f14]">
          Timezone
        </h2>
        <p className="mb-3 text-sm text-[#78716c]">
          Used to compute your local day for streak tracking.
        </p>
        <TimezoneSelector currentTimezone={currentTimezone} />
      </section>
    </main>
  );
}
