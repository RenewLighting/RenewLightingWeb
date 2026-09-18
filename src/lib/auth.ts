import type { NextAuthOptions } from "next-auth";
import GoogleProvider from "next-auth/providers/google";

const allowedDomain = "renewlighting.com";

export const authOptions: NextAuthOptions = {
  pages: {
    signIn: "/employee",
    error: "/employee",
  },
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID ?? "",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? "",
      authorization: {
        params: {
          hd: allowedDomain,
          prompt: "select_account",
        },
      },
    }),
  ],
  callbacks: {
    async signIn({ profile }) {
      const email = profile?.email?.toLowerCase();
      const emailVerified = (profile as { email_verified?: boolean } | undefined)
        ?.email_verified;

      return emailVerified === true && email?.endsWith(`@${allowedDomain}`) === true;
    },
  },
  session: {
    strategy: "jwt",
  },
};