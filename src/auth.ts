import NextAuth from "next-auth";
import GitHub from "next-auth/providers/github";
import { getAllowedGithubLogin } from "@/lib/env";

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    GitHub({
      clientId: process.env.GITHUB_ID,
      clientSecret: process.env.GITHUB_SECRET,
    }),
  ],
  callbacks: {
    async signIn({ profile }) {
      // GitHub profile.login is the username.
      const login = (profile as { login?: string } | undefined)?.login;
      return login === getAllowedGithubLogin();
    },
  },
});
