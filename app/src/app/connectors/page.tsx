import { redirect } from "next/navigation";
import Link from "next/link";
import { auth } from "@/lib/auth";
import { createInstallState } from "@/lib/github-app";
import { createSupabaseAdmin } from "@/lib/supabase";

export default async function ConnectorsPage() {
  const session = await auth();
  if (!session?.user) {
    redirect("/api/auth/signin?callbackUrl=/connectors");
  }

  const user = session.user as { userId?: string };
  if (!user.userId) redirect("/api/auth/signin?callbackUrl=/connectors");

  const supabase = createSupabaseAdmin();
  const { data: installations } = await supabase
    .from("user_github_installations")
    .select("installation_id")
    .eq("user_id", user.userId)
    .limit(1);
  const isConnected = (installations?.length ?? 0) > 0;

  const appSlug = process.env.GITHUB_APP_SLUG;
  const installAppUrl =
    appSlug && user.userId
      ? `https://github.com/apps/${appSlug}/installations/new?state=${encodeURIComponent(createInstallState(user.userId))}`
      : null;

  return (
    <main className="mx-auto max-w-2xl px-4 py-8">
      <Link
        href="/"
        className="mb-6 inline-block text-sm text-[#78716c] hover:text-[#2a1f14]"
      >
        ← Back
      </Link>
      <h1 className="mb-6 font-[family-name:var(--font-fraunces)] text-2xl font-semibold text-[#2a1f14]">
        Connectors
      </h1>
      <p className="mb-6 text-sm text-[#78716c]">
        Connect services to automatically track progress across your projects.
      </p>

      {installAppUrl ? (
        <div className="card w-80 rounded-xl p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#f5f0e8]">
                <svg
                  viewBox="0 0 24 24"
                  fill="currentColor"
                  className="h-5 w-5 text-[#2a1f14]"
                >
                  <path d="M12 0C5.37 0 0 5.373 0 12c0 5.303 3.438 9.8 8.205 11.387.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61-.546-1.387-1.333-1.756-1.333-1.756-1.09-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23A11.51 11.51 0 0 1 12 5.803c1.02.005 2.047.138 3.006.404 2.29-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576C20.566 21.797 24 17.3 24 12c0-6.627-5.373-12-12-12z" />
                </svg>
              </div>
              <span className="font-medium text-[#2a1f14]">GitHub</span>
            </div>
            {isConnected ? (
              <span className="flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                Connected
              </span>
            ) : (
              <span className="flex items-center gap-1.5 rounded-full bg-[#f5f0e8] px-2.5 py-1 text-xs font-medium text-[#a8a29e]">
                <span className="h-1.5 w-1.5 rounded-full bg-[#c9b99a]" />
                Not connected
              </span>
            )}
          </div>
          <p className="mt-3 text-sm text-[#78716c]">
            Automatically track commits across your projects.
          </p>
          <div className="mt-4">
            <a
              href={installAppUrl}
              target={isConnected ? "_blank" : undefined}
              rel={isConnected ? "noopener noreferrer" : undefined}
              className="inline-block rounded-full bg-[#b5522a] px-4 py-2 text-sm font-medium text-white hover:bg-[#9a4522]"
            >
              {isConnected ? "Reconfigure" : "Connect GitHub"}
            </a>
          </div>
        </div>
      ) : (
        <p className="text-sm text-[#78716c]">
          Connectors are not configured for this environment.
        </p>
      )}
    </main>
  );
}
