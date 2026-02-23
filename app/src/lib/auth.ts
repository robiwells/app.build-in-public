import NextAuth from "next-auth";
import GitHub from "next-auth/providers/github";
import { createSupabaseAdmin } from "@/lib/supabase";

export const { handlers, signIn, signOut, auth } = NextAuth({
  providers: [
    GitHub({
      clientId: process.env.GITHUB_ID!,
      clientSecret: process.env.GITHUB_SECRET!,
      authorization: { params: { scope: "read:user repo" } },
    }),
  ],
  session: { strategy: "jwt", maxAge: 30 * 24 * 60 * 60 },
  callbacks: {
    async signIn({ user, profile }) {
      const ghProfile = profile as { id?: string; login?: string } | null;
      if (!ghProfile?.id) return true;
      const supabase = createSupabaseAdmin();
      const { data: dbUser } = await supabase
        .from("users")
        .upsert(
          {
            github_id: Number(ghProfile.id),
            username: ghProfile.login ?? user?.name ?? "unknown",
            avatar_url: user?.image ?? null,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "github_id" }
        )
        .select("id")
        .single();
      if (dbUser?.id) (user as Record<string, unknown>).dbUserId = dbUser.id;
      return true;
    },
    async jwt({ token, user, profile, account }) {
      if (account?.access_token) token.accessToken = account.access_token;
      if (user && (user as Record<string, unknown>).dbUserId) {
        token.userId = (user as Record<string, unknown>).dbUserId as string;
        token.username =
          (profile as { login?: string })?.login ?? (user.name as string);
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        const u = session.user as unknown as Record<string, unknown>;
        u.userId = token.userId;
        u.username = token.username;
      }
      (session as unknown as Record<string, unknown>).accessToken = token.accessToken;
      return session;
    },
    async redirect({ url, baseUrl }) {
      if (url.startsWith("/")) return `${baseUrl}${url}`;
      if (new URL(url).origin !== baseUrl) return baseUrl;
      return url;
    },
  },
  pages: {
    signIn: "/",
  },
  trustHost: true,
});
