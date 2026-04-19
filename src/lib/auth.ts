import NextAuth from "next-auth";
import { PrismaAdapter } from "@auth/prisma-adapter";
import Google from "next-auth/providers/google";
import Credentials from "next-auth/providers/credentials";
import { prisma } from "./prisma";

// Strava custom OAuth provider
const StravaProvider = {
  id: "strava",
  name: "Strava",
  type: "oauth" as const,
  authorization: {
    url: "https://www.strava.com/oauth/authorize",
    params: {
      scope: "read,activity:read_all",
      approval_prompt: "auto",
    },
  },
  token: "https://www.strava.com/oauth/token",
  userinfo: "https://www.strava.com/api/v3/athlete",
  clientId: process.env.STRAVA_CLIENT_ID,
  clientSecret: process.env.STRAVA_CLIENT_SECRET,
  allowDangerousEmailAccountLinking: true,
  profile(profile: {
    id: number;
    firstname: string;
    lastname: string;
    email: string;
    profile_medium: string;
  }) {
    return {
      id: profile.id.toString(),
      name: `${profile.firstname} ${profile.lastname}`,
      email: profile.email,
      image: profile.profile_medium,
    };
  },
};

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(prisma),
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    }),
    StravaProvider,
    Credentials({
      name: "Email",
      credentials: {
        email: { label: "Email", type: "email" },
      },
      async authorize(credentials) {
        if (!credentials?.email) return null;
        const user = await prisma.user.findUnique({
          where: { email: credentials.email as string },
        });
        return user;
      },
    }),
  ],
  callbacks: {
    async session({ session, user }) {
      if (session.user) {
        session.user.id = user.id;
      }
      return session;
    },
    async signIn({ user, account }) {
      // Store Strava OAuth tokens separately for API access
      if (account?.provider === "strava" && user.id) {
        await prisma.oAuthToken.upsert({
          where: { userId_provider: { userId: user.id, provider: "strava" } },
          create: {
            userId: user.id,
            provider: "strava",
            accessToken: account.access_token!,
            refreshToken: account.refresh_token,
            expiresAt: new Date((account.expires_at ?? 0) * 1000),
            scope: account.scope,
          },
          update: {
            accessToken: account.access_token!,
            refreshToken: account.refresh_token,
            expiresAt: new Date((account.expires_at ?? 0) * 1000),
            scope: account.scope,
          },
        });
      }
      return true;
    },
  },
  pages: {
    signIn: "/auth/signin",
  },
  session: {
    strategy: "database",
  },
});

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      name?: string | null;
      email?: string | null;
      image?: string | null;
    };
  }
}
