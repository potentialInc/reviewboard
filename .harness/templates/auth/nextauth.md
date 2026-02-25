# NextAuth.js Authentication Template

## When to Use

- Next.js projects needing OAuth + email/password auth
- Social login (Google, GitHub, Discord, etc.)
- Session management with JWT or database sessions

## Stack Requirements

- `next-auth` (v5+ for App Router, v4 for Pages Router)
- Database adapter: `@auth/prisma-adapter` or `@auth/drizzle-adapter`

## File Structure

```
src/
├── config/
│   └── auth.ts              # NextAuth configuration
├── types/
│   └── auth.ts              # Session & user type extensions
├── service/
│   └── auth-service.ts      # Auth business logic
├── ui/
│   ├── auth/
│   │   ├── login-form.tsx
│   │   ├── signup-form.tsx
│   │   └── auth-provider.tsx
│   └── components/
│       └── user-menu.tsx
└── app/
    ├── api/auth/[...nextauth]/route.ts
    ├── login/page.tsx
    └── signup/page.tsx
```

## Implementation Steps

### 1. Install Dependencies

```bash
npm install next-auth @auth/prisma-adapter
# or
npm install next-auth @auth/drizzle-adapter
```

### 2. Auth Config (`src/config/auth.ts`)

```typescript
import { NextAuthOptions } from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import CredentialsProvider from "next-auth/providers/credentials";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { prisma } from "@/config/database";
import bcrypt from "bcryptjs";

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma),
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
    CredentialsProvider({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;

        const user = await prisma.user.findUnique({
          where: { email: credentials.email },
        });

        if (!user?.hashedPassword) return null;

        const isValid = await bcrypt.compare(
          credentials.password,
          user.hashedPassword
        );

        return isValid ? user : null;
      },
    }),
  ],
  session: { strategy: "jwt" },
  pages: {
    signIn: "/login",
    error: "/login",
  },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = user.role;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        session.user.role = token.role as string;
      }
      return session;
    },
  },
};
```

### 3. Environment Variables

```env
# .env.local
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=<generate-with-openssl-rand-base64-32>
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
```

### 4. Middleware (`middleware.ts`)

```typescript
export { default } from "next-auth/middleware";

export const config = {
  matcher: ["/dashboard/:path*", "/settings/:path*", "/api/protected/:path*"],
};
```

### 5. Database Schema (Prisma)

```prisma
model User {
  id             String    @id @default(cuid())
  name           String?
  email          String?   @unique
  emailVerified  DateTime?
  image          String?
  hashedPassword String?
  role           String    @default("user")
  accounts       Account[]
  sessions       Session[]
  createdAt      DateTime  @default(now())
  updatedAt      DateTime  @updatedAt
}

model Account {
  id                String  @id @default(cuid())
  userId            String
  type              String
  provider          String
  providerAccountId String
  refresh_token     String?
  access_token      String?
  expires_at        Int?
  token_type        String?
  scope             String?
  id_token          String?
  session_state     String?
  user              User    @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([provider, providerAccountId])
}

model Session {
  id           String   @id @default(cuid())
  sessionToken String   @unique
  userId       String
  expires      DateTime
  user         User     @relation(fields: [userId], references: [id], onDelete: Cascade)
}
```

## Security Checklist

- [ ] `NEXTAUTH_SECRET` is set and unique per environment
- [ ] CSRF protection enabled (default in NextAuth)
- [ ] Rate limiting on credentials endpoint
- [ ] Password hashing with bcrypt (cost factor >= 10)
- [ ] Secure cookie settings in production
- [ ] OAuth redirect URIs properly configured
