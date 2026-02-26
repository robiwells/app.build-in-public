import Link from "next/link";
import Image from "next/image";
import { auth } from "@/lib/auth";
import { UserMenu } from "@/components/UserMenu";
import { SignInModal } from "@/components/SignInModal";

export async function Header() {
  const session = await auth();
  const user = session?.user as { username?: string; userId?: string } | undefined;

  return (
    <header className="border-b border-[#e8ddd0] bg-[#faf7f2]">
      <div className="mx-auto flex h-14 max-w-4xl items-center justify-between px-4">
        <Link href="/" className="flex items-center gap-2">
          <Image
            src="/logo-v2-smaller-transparent.png"
            alt="the Daily Log"
            width={140}
            height={36}
            className="h-12 w-auto"
            priority
          />
        </Link>
        <nav className="flex items-center gap-4">
          <Link
            href="/projects"
            className="text-sm font-medium text-[#78716c] hover:text-[#2a1f14]"
          >
            Projects
          </Link>
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
