import Link from "next/link";
import { auth } from "@/lib/auth";
import { SignOutButton } from "@/components/SignOutButton";

export async function Header() {
  const session = await auth();
  const user = session?.user as { username?: string; userId?: string } | undefined;

  return (
    <header className="border-b border-zinc-200 dark:border-zinc-800">
      <div className="mx-auto flex h-14 max-w-4xl items-center justify-between px-4">
        <Link href="/" className="font-semibold text-zinc-900 dark:text-zinc-100">
          Build in Public
        </Link>
        <nav className="flex items-center gap-4">
          {session && user?.username ? (
            <>
              <Link
                href={`/u/${user.username}`}
                className="text-sm text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
              >
                My profile
              </Link>
              <Link
                href="/settings"
                className="text-sm text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
              >
                Settings
              </Link>
              <span className="text-sm text-zinc-500 dark:text-zinc-400">
                Signed in as {user.username}
              </span>
              <SignOutButton />
            </>
          ) : (
            <Link
              href="/api/auth/signin?callbackUrl=/onboarding"
              className="rounded-full bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
            >
              Sign in with GitHub
            </Link>
          )}
        </nav>
      </div>
    </header>
  );
}
