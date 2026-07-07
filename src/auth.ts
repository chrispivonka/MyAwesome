import NextAuth from "next-auth";
import GitHub from "next-auth/providers/github";
import { DrizzleAdapter } from "@auth/drizzle-adapter";
import { db } from "@/lib/db";
import {
  accounts,
  sessions,
  users,
  verificationTokens,
} from "@/lib/db/schema";
import { buildProfileForUser } from "@/lib/github/profile";

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: DrizzleAdapter(db, {
    usersTable: users,
    accountsTable: accounts,
    sessionsTable: sessions,
    verificationTokensTable: verificationTokens,
  }),
  providers: [
    GitHub({
      clientId: process.env.GITHUB_CLIENT_ID,
      clientSecret: process.env.GITHUB_CLIENT_SECRET,
      // read:user + user:email cover profile data; the resulting access token
      // (stored in the accounts table) is reused to fetch starred repos for
      // profile building — see src/lib/github/profile.ts.
      authorization: { params: { scope: "read:user user:email" } },
    }),
  ],
  session: { strategy: "database" },
  // Not hosted on Vercel (which auto-trusts the host via a detected env
  // var) — trust the host explicitly so callback URL validation works on
  // any platform.
  trustHost: true,
  callbacks: {
    session({ session, user }) {
      session.user.id = user.id;
      return session;
    },
  },
  events: {
    async signIn({ user }) {
      // Awaited (not fire-and-forget) so it works the same on every host —
      // background work after a response is sent isn't reliable on all
      // serverless runtimes the way it is on Vercel. Fetches starred
      // repos/languages/topics only; profile *embedding* happens later via
      // the daily-sync GitHub Actions workflow, not in this Lambda.
      if (user.id) {
        await buildProfileForUser(user.id).catch(console.error);
      }
    },
  },
});
