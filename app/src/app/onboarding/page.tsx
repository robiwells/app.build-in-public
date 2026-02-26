import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { createSupabaseAdmin } from "@/lib/supabase";
import { createInstallState } from "@/lib/github-app";

const ERROR_MESSAGES: Record<string, string> = {
  invalid_setup: "Setup link expired or invalid. Try connecting with GitHub App again.",
  github_app: "Could not load repos from the GitHub App. Try again.",
  no_repos: "No repositories found for that installation. Install the app on a repo first.",
};

type Props = { searchParams: Promise<{ error?: string }> };

export default async function OnboardingPage({ searchParams }: Props) {
  const session = await auth();
  if (!session?.user) {
    redirect("/api/auth/signin?callbackUrl=/onboarding");
  }

  const user = session.user as { userId?: string; username?: string };
  if (!user.userId || !user.username) {
    redirect("/api/auth/signin?callbackUrl=/onboarding");
  }

  // Check if user already has any active connector sources linked to projects
  const supabase = createSupabaseAdmin();
  const { data: userConnectors } = await supabase
    .from("user_connectors")
    .select("id")
    .eq("user_id", user.userId);
  const connectorIds = (userConnectors ?? []).map((c) => c.id);

  if (connectorIds.length > 0) {
    const { data: sources } = await supabase
      .from("project_connector_sources")
      .select("id")
      .in("user_connector_id", connectorIds)
      .eq("active", true)
      .limit(1);
    if (sources && sources.length > 0) {
      redirect(`/u/${user.username}`);
    }
  }

  const { error: errorCode } = await searchParams;
  const errorMessage = errorCode ? ERROR_MESSAGES[errorCode] ?? "Something went wrong." : null;

  const appSlug = process.env.GITHUB_APP_SLUG;
  const installAppUrl =
    appSlug && user.userId
      ? `https://github.com/apps/${appSlug}/installations/new?state=${encodeURIComponent(createInstallState(user.userId))}`
      : null;

  return (
    <main className="mx-auto max-w-2xl px-4 py-8">
      <h1 className="mb-6 font-[family-name:var(--font-fraunces)] text-2xl font-semibold text-[#2a1f14]">
        Connect a repo to track
      </h1>
      {errorMessage && (
        <p className="mb-4 text-sm text-amber-600">{errorMessage}</p>
      )}
      {installAppUrl ? (
        <div>
          <a
            href={installAppUrl}
            className="inline-block rounded-full bg-[#b5522a] px-4 py-2 text-sm font-medium text-white hover:bg-[#9a4522]"
          >
            Connect with GitHub App
          </a>
          <p className="mt-2 text-sm text-[#78716c]">
            Install the app on a repo to track commits automatically—no webhook setup.
          </p>
        </div>
      ) : (
        <p className="text-sm text-[#78716c]">
          Set <code className="rounded bg-[#f5f0e8] px-1">GITHUB_APP_SLUG</code> and other GitHub App env vars in <code className="rounded bg-[#f5f0e8] px-1">.env.local</code>. See <strong>DEPLOY.md</strong> (in the app directory) section 5.
        </p>
      )}
    </main>
  );
}
