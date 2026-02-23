import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { createInstallState } from "@/lib/github-app";
import { ProjectManager } from "@/components/ProjectManager";

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

  return (
    <main className="mx-auto max-w-2xl px-4 py-8">
      <h1 className="mb-6 text-2xl font-semibold text-zinc-900 dark:text-zinc-100">
        Settings
      </h1>

      <section className="mb-8">
        <ProjectManager />
      </section>

      {installAppUrl && (
        <section>
          <h2 className="mb-3 text-lg font-semibold text-zinc-900 dark:text-zinc-100">
            Connectors
          </h2>
          <a
            href={installAppUrl}
            className="inline-block rounded-full bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
          >
            GitHub
          </a>
          <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
            Install or reconfigure the connectors to automatically track progress across your projects.
          </p>
        </section>
      )}
    </main>
  );
}
