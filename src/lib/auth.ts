import NextAuth, { type DefaultSession } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db";
import { Role } from "@prisma/client";
import { NextResponse } from "next/server";
import { readCanonicalAuthOrigin } from "@/lib/auth-origin";

declare module "next-auth" {
  interface Session {
    user: { id: string; role: Role; authVersion: number } & DefaultSession["user"];
  }
  interface User {
    role: Role;
    authVersion: number;
  }
}

const canonicalAuthOrigin = readCanonicalAuthOrigin();

export const { handlers, auth, signIn, signOut } = NextAuth({
  session: { strategy: "jwt" },
  // AUTH_URL is validated as the exact School Screen HTTPS origin. Auth.js
  // derives trustHost from that canonical URL; middleware still rejects any
  // incoming non-canonical Host before this handler is reached.
  trustHost: Boolean(canonicalAuthOrigin),
  pages: {
    signIn: "/login",
  },
  providers: [
    CredentialsProvider({
      name: "credentials",
      credentials: {
        identifier: { label: "البريد أو الجوال", type: "text" },
        password: { label: "كلمة المرور", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.identifier || !credentials?.password) {
          return null;
        }

        const identifier = credentials.identifier as string;
        const password = credentials.password as string;

        const user = await prisma.user.findFirst({
          where: {
            OR: [{ email: identifier }, { phone: identifier }],
            isActive: true,
          },
        });

        if (!user || !user.password) {
          return null;
        }

        const isValid = await bcrypt.compare(password, user.password);
        if (!isValid) {
          return null;
        }

        return {
          id: user.id,
          name: user.name,
          email: user.email || undefined,
          role: user.role,
          authVersion: user.authVersion,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        (token as { id?: string; role?: Role; authVersion?: number }).id = user.id!;
        (token as { id?: string; role?: Role; authVersion?: number }).role = user.role;
        (token as { id?: string; role?: Role; authVersion?: number }).authVersion = user.authVersion;
      }
      return token;
    },
    async session({ session, token }) {
      const authToken = token as { id?: string; role?: Role; authVersion?: number };
      if (!authToken.id || typeof authToken.authVersion !== "number") return { expires: session.expires };
      const current = await prisma.user.findUnique({
        where: { id: authToken.id },
        select: { isActive: true, authVersion: true, role: true },
      });
      // A reset increments authVersion. An older JWT is then represented as an anonymous session.
      if (!current?.isActive || current.authVersion !== authToken.authVersion) return { expires: session.expires };
      session.user.id = authToken.id ?? "";
      session.user.role = current.role;
      session.user.authVersion = authToken.authVersion ?? 0;
      return session;
    },
  },
});

// التحقق من الصلاحيات
export async function requireAuth() {
  const session = await auth();
  if (!session?.user) {
    throw new Error("غير مصرح");
  }
  return session;
}

export async function requireRole(...roles: Role[]) {
  const session = await requireAuth();
  if (!roles.includes(session.user.role)) {
    return NextResponse.json({ error: "ليس لديك صلاحية للوصول إلى هذه الصفحة" }, { status: 403 });
  }
  return session;
}
