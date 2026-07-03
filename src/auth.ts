import NextAuth from "next-auth";
import GitHub from "next-auth/providers/github";
import { DrizzleAdapter } from "@auth/drizzle-adapter";
import { after } from "next/server";
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
  callbacks: {
    session({ session, user }) {
      session.user.id = user.id;
      return session;
    },
  },
  events: {
    signIn({ user }) {
      // Runs after the sign-in response is sent (Vercel keeps the function
      // alive for this) so login doesn't wait on GitHub API calls + local
      // embedding inference.
      if (user.id) {
        after(() => buildProfileForUser(user.id!).catch(console.error));
      }
    },
  },
});
