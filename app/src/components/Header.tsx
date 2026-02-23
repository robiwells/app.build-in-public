import Link from "next/link";
import { auth } from "@/lib/auth";
import { UserMenu } from "@/components/UserMenu";
import { SignInModal } from "@/components/SignInModal";

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
            <UserMenu
              username={user.username}
              avatarUrl={session.user?.image}
              profileHref={`/u/${user.username}`}
            />
          ) : (
            <SignInModal />
          )}
        </nav>
      </div>
    </header>
  );
}
