import NextAuth, { type DefaultSession } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db";
import { Role } from "@prisma/client";
import { NextResponse } from "next/server";

declare module "next-auth" {
  interface Session {
    user: { id: string; role: Role; authVersion: number } & DefaultSession["user"];
  }
  interface User {
    role: Role;
    authVersion: number;
  }
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  session: { strategy: "jwt" },
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
      session.user.id = authToken.id ?? "";
      session.user.role = authToken.role ?? Role.MEMBER;
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
