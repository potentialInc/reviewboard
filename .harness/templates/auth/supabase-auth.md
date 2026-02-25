# Supabase Auth Template

## When to Use

- Projects using Supabase as backend
- Quick auth setup with minimal custom code
- Row-Level Security (RLS) for data access control

## Stack Requirements

- `@supabase/supabase-js` (client)
- `@supabase/ssr` (server-side rendering support)
- Supabase project (free tier available)

## File Structure

```
src/
├── config/
│   ├── supabase-client.ts     # Browser client
│   └── supabase-server.ts     # Server client (SSR)
├── types/
│   └── auth.ts                # User/session types
├── service/
│   └── auth-service.ts        # Auth business logic
├── ui/
│   ├── auth/
│   │   ├── login-form.tsx
│   │   ├── signup-form.tsx
│   │   └── auth-provider.tsx
│   └── components/
│       └── user-menu.tsx
└── app/
    ├── auth/callback/route.ts  # OAuth callback
    ├── login/page.tsx
    └── signup/page.tsx
```

## Implementation Steps

### 1. Install Dependencies

```bash
npm install @supabase/supabase-js @supabase/ssr
```

### 2. Supabase Client (`src/config/supabase-client.ts`)

```typescript
import { createBrowserClient } from "@supabase/ssr";

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
```

### 3. Server Client (`src/config/supabase-server.ts`)

```typescript
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export async function createServerSupabase() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll(); },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          );
        },
      },
    }
  );
}
```

### 4. Auth Service (`src/service/auth-service.ts`)

```typescript
import { createClient } from "@/config/supabase-client";

export const authService = {
  async signUp(email: string, password: string) {
    const supabase = createClient();
    const { data, error } = await supabase.auth.signUp({ email, password });
    if (error) throw new Error(`Signup failed: ${error.message}`);
    return data;
  },

  async signIn(email: string, password: string) {
    const supabase = createClient();
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (error) throw new Error(`Login failed: ${error.message}`);
    return data;
  },

  async signInWithOAuth(provider: "google" | "github") {
    const supabase = createClient();
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider,
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    });
    if (error) throw new Error(`OAuth failed: ${error.message}`);
    return data;
  },

  async signOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
  },

  async getSession() {
    const supabase = createClient();
    const { data } = await supabase.auth.getSession();
    return data.session;
  },
};
```

### 5. OAuth Callback (`app/auth/callback/route.ts`)

```typescript
import { createServerSupabase } from "@/config/supabase-server";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/dashboard";

  if (code) {
    const supabase = await createServerSupabase();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(`${origin}${next}`);
  }

  return NextResponse.redirect(`${origin}/login?error=auth_callback_failed`);
}
```

### 6. Middleware (`middleware.ts`)

```typescript
import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

const protectedRoutes = ["/dashboard", "/settings", "/api/protected"];

export async function middleware(request: NextRequest) {
  const isProtected = protectedRoutes.some((r) =>
    request.nextUrl.pathname.startsWith(r)
  );
  if (!isProtected) return NextResponse.next();

  let response = NextResponse.next({ request });
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return request.cookies.getAll(); },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            response.cookies.set(name, value, options);
          });
        },
      },
    }
  );

  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  return response;
}
```

### 7. Environment Variables

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...  # Server-only, never expose
```

### 8. RLS Policy (SQL)

```sql
-- Enable RLS on tables
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Users can only read/update their own profile
CREATE POLICY "Users read own profile"
  ON profiles FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users update own profile"
  ON profiles FOR UPDATE USING (auth.uid() = id);
```

## Security Checklist

- [ ] `SUPABASE_SERVICE_ROLE_KEY` is never exposed to client
- [ ] RLS enabled on all user-facing tables
- [ ] Email confirmation enabled in Supabase dashboard
- [ ] OAuth redirect URLs configured in Supabase dashboard
- [ ] Rate limiting configured in Supabase dashboard
