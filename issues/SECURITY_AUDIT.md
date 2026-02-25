# Security Audit Report -- ReviewBoard

**Date:** 2026-02-25
**Auditor:** Security Agent (automated)
**Scope:** `app/src/` -- all API routes, authentication, middleware, Supabase integration, client components, env handling
**Framework:** OWASP Top 10 (2021) baseline

---

## Summary Statistics

| Severity | Count |
|----------|-------|
| CRITICAL | 3 |
| HIGH | 6 |
| MEDIUM | 5 |
| LOW | 4 |
| **Total** | **18** |

---

## CRITICAL Vulnerabilities

### C-01: Hardcoded Default Session Secret Used in Production Fallback

**Severity:** CRITICAL
**OWASP:** A02:2021 -- Cryptographic Failures
**Location:**
- `app/src/proxy.ts:4`
- `app/src/lib/auth.ts:6`

**Description:**
Both files contain the same hardcoded fallback secret:

```ts
const SESSION_SECRET = process.env.SESSION_SECRET || 'reviewboard-default-secret-change-in-production-32chars!';
```

If `SESSION_SECRET` is not set in production environment variables, the application silently falls back to a publicly known, hardcoded secret. An attacker who reads the source code (which is version-controlled) can forge arbitrary session cookies, impersonate any user including admin, and gain full administrative access.

**Fix Recommendation:**
- Remove the fallback entirely. Fail hard if `SESSION_SECRET` is not set.
- Add `SESSION_SECRET` to the required variables in `app/src/lib/env.ts`.
- Example: `const SESSION_SECRET = process.env.SESSION_SECRET ?? (() => { throw new Error('SESSION_SECRET is required'); })();`

---

### C-02: Plaintext Password Storage in Database

**Severity:** CRITICAL
**OWASP:** A02:2021 -- Cryptographic Failures
**Location:**
- `app/src/lib/supabase/schema.sql:28` -- `password text not null default 'Potential'`
- `app/src/app/api/auth/login/route.ts:38` -- `account.password !== password`
- `app/src/app/api/projects/route.ts:203` -- `password: 'Potential'`
- `app/src/app/api/projects/[id]/route.ts:85` -- `client_password: clientAcc?.password`

**Description:**
Client account passwords are stored as plaintext in the database. The login route compares them with a direct string comparison (`account.password !== password`). Additionally, the default password for all auto-provisioned accounts is the same static string `'Potential'`. The project detail API endpoint also returns the plaintext password in the response body (`client_password`).

**Fix Recommendation:**
- Hash passwords using bcrypt or argon2 before storing.
- Compare using constant-time hash comparison (e.g., `bcrypt.compare()`).
- Never return passwords in API responses.
- Generate random passwords per client account instead of using a global default.

---

### C-03: Middleware (proxy.ts) Is Not Wired Up -- Auth Bypass on All API Routes

**Severity:** CRITICAL
**OWASP:** A01:2021 -- Broken Access Control
**Location:**
- `app/src/proxy.ts` -- exported as `proxy()` but never registered as Next.js middleware
- No `middleware.ts` file exists at `app/src/middleware.ts` or `app/middleware.ts`

**Description:**
The `proxy.ts` file exports a `proxy()` function and a `config` matcher, but Next.js middleware must be defined in a file named `middleware.ts` at the project root (or `src/`), exporting a function named `middleware` (not `proxy`). Since no such file exists, the middleware-level auth gate is completely inactive. All route protection currently depends solely on each API route handler calling `getSession()` individually.

While each API route does call `getSession()`, the middleware was clearly intended as an additional security layer for path-based access control. Its absence means:
- There is no centralized auth enforcement; a single missed `getSession()` call in any future route creates an auth bypass.
- The role-based redirect logic (admin vs. client path access) never executes.

**Fix Recommendation:**
- Rename `proxy.ts` to `middleware.ts` (in `app/src/` or project root depending on Next.js version).
- Rename the exported function from `proxy` to `middleware`.
- Verify the matcher config is applied correctly.

---

## HIGH Vulnerabilities

### H-01: Admin Credentials Stored in Environment Variables Without Rotation

**Severity:** HIGH
**OWASP:** A07:2021 -- Identification and Authentication Failures
**Location:**
- `app/src/app/api/auth/login/route.ts:25` -- `process.env.ADMIN_ID && password === process.env.ADMIN_PASSWORD`
- `app/.env.local:10-11` -- `ADMIN_ID=admin`, `ADMIN_PASSWORD=Potential`

**Description:**
Admin authentication uses a single hardcoded credential pair from environment variables. There is no password rotation mechanism, no multi-factor authentication, and the default values (`admin` / `Potential`) are trivially guessable. If any developer or CI system has these env vars exposed, admin access is compromised.

**Fix Recommendation:**
- Store admin accounts in the database with hashed passwords (same as client accounts but with an `is_admin` flag or separate admin table).
- Implement password change functionality.
- Add MFA for admin accounts.
- At minimum, enforce password complexity requirements.

---

### H-02: Slack Bot Token Exposed in .env.local with Real Credentials

**Severity:** HIGH
**OWASP:** A02:2021 -- Cryptographic Failures / A09:2021 -- Security Logging and Monitoring Failures
**Location:**
- `app/.env.local:14` -- `SLACK_BOT_TOKEN=xoxb-***REDACTED***`

**Description:**
The `.env.local` file contains a real Slack Bot Token. While `.env.local` is listed in `.gitignore` and is not tracked by git, its presence in the working directory means it could be accidentally committed or exposed.

**Fix Recommendation:**
- Rotate the Slack Bot Token immediately (assume it may have been compromised).
- Use a secrets manager (e.g., Vercel Environment Variables, AWS Secrets Manager) instead of local files.
- Ensure `.env.local.example` never contains real token values (currently it does not -- good).
- Add pre-commit hooks to scan for secrets.

---

### H-03: No CSRF Protection on State-Mutating Endpoints

**Severity:** HIGH
**OWASP:** A01:2021 -- Broken Access Control
**Location:**
- All POST/PATCH/DELETE API routes (`app/src/app/api/*/route.ts`)

**Description:**
No CSRF tokens are implemented. The session cookie uses `sameSite: 'strict'`, which mitigates most CSRF attacks from cross-origin contexts. However, `sameSite: 'strict'` does not protect against same-site attacks (e.g., subdomain takeover) and some browser-specific edge cases. There is no double-submit cookie pattern or custom header verification.

**Fix Recommendation:**
- The `sameSite: 'strict'` cookie attribute provides good baseline protection. For defense-in-depth:
  - Add a custom header check (e.g., verify `X-Requested-With` or `Origin` header) on all mutating API routes.
  - Consider implementing a CSRF token pattern for the most sensitive operations (login, project deletion).

---

### H-04: SQL-like Injection via Supabase `ilike` with Unsanitized User Input

**Severity:** HIGH
**OWASP:** A03:2021 -- Injection
**Location:**
- `app/src/app/api/feedback/route.ts:44` -- `query = query.ilike('text', \`%${search}%\`)`

**Description:**
The `search` query parameter from the URL is interpolated directly into the `ilike` pattern. While Supabase's PostgREST layer parameterizes the value (preventing SQL injection), the LIKE/ILIKE pattern characters (`%`, `_`) in the user input are not escaped. An attacker can craft search queries using `%` and `_` wildcards to perform pattern-based data exfiltration or cause performance degradation with expensive LIKE patterns.

**Fix Recommendation:**
- Escape LIKE special characters (`%` and `_`) in user input before passing to `ilike`:
  ```ts
  const escapedSearch = search.replace(/%/g, '\\%').replace(/_/g, '\\_');
  query = query.ilike('text', `%${escapedSearch}%`);
  ```

---

### H-05: Client Password Returned in API Response

**Severity:** HIGH
**OWASP:** A01:2021 -- Broken Access Control
**Location:**
- `app/src/app/api/projects/[id]/route.ts:84-85`:
  ```ts
  client_id: clientAcc?.login_id || null,
  client_password: clientAcc?.password || 'Potential',
  ```
- `app/src/app/api/projects/route.ts:216-222` (POST response includes plaintext password)

**Description:**
The GET endpoint for project details returns the client account's plaintext password in the API response. This means any admin user (or anyone who intercepts the response) sees the password. The POST endpoint for project creation also returns the default password. These passwords are visible in browser DevTools, network logs, and any monitoring system.

**Fix Recommendation:**
- Never return passwords in API responses.
- For the project creation flow, display the password once in a secure UI flow and never send it again.
- If password display is needed, use a separate one-time-use endpoint with additional authorization.

---

### H-06: Rate Limiter Uses In-Memory Storage (Bypassable in Serverless/Multi-Instance)

**Severity:** HIGH
**OWASP:** A07:2021 -- Identification and Authentication Failures
**Location:**
- `app/src/lib/rate-limit.ts` -- `const attempts = new Map<string, ...>()`
- `app/src/app/api/auth/login/route.ts:11` -- `checkRateLimit(\`login:${ip}\`, 5, 60_000)`

**Description:**
The rate limiter stores attempt counts in a JavaScript `Map` in process memory. In a serverless environment (Vercel, AWS Lambda) or multi-instance deployment, each instance has its own independent map, so an attacker can bypass rate limits by having their requests distributed across instances. Additionally, the rate limit state is lost on every deployment or cold start. The `x-forwarded-for` header used to identify clients is also spoofable without proper configuration.

**Fix Recommendation:**
- Use a distributed rate limiter backed by Redis, Upstash, or a similar external store.
- Validate that `x-forwarded-for` comes from a trusted proxy (e.g., Vercel's edge).
- Consider using Vercel's built-in edge rate limiting or middleware-based rate limiting.

---

## MEDIUM Vulnerabilities

### M-01: No Security Headers Configured

**Severity:** MEDIUM
**OWASP:** A05:2021 -- Security Misconfiguration
**Location:**
- `app/next.config.ts` -- no `headers()` configuration
- No middleware setting security headers

**Description:**
The application does not set any security headers:
- No `Content-Security-Policy` (CSP) header
- No `X-Frame-Options` or `X-Content-Type-Options`
- No `Strict-Transport-Security` (HSTS)
- No `Referrer-Policy`
- No `Permissions-Policy`

This makes the application more susceptible to clickjacking, MIME-type sniffing attacks, and lacks defense-in-depth against XSS.

**Fix Recommendation:**
Add security headers in `next.config.ts`:
```ts
async headers() {
  return [{
    source: '/(.*)',
    headers: [
      { key: 'X-Frame-Options', value: 'DENY' },
      { key: 'X-Content-Type-Options', value: 'nosniff' },
      { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
      { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
      { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
      { key: 'Content-Security-Policy', value: "default-src 'self'; ..." },
    ],
  }];
}
```

---

### M-02: No Input Validation on API Route Parameters (UUID Format)

**Severity:** MEDIUM
**OWASP:** A03:2021 -- Injection
**Location:**
- All `[id]` and `[screenId]` dynamic route parameters across API routes

**Description:**
Dynamic route parameters like `id` and `screenId` are used directly in Supabase queries without validating that they are valid UUIDs. While Supabase/PostgreSQL will reject invalid UUIDs, the error messages may leak internal implementation details (table names, column types).

**Fix Recommendation:**
- Validate UUID format before using in queries:
  ```ts
  const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!UUID_REGEX.test(id)) return NextResponse.json({ error: 'Invalid ID' }, { status: 400 });
  ```
- Return generic error messages instead of forwarding Supabase errors.

---

### M-03: Supabase Error Messages Leaked to Client

**Severity:** MEDIUM
**OWASP:** A04:2021 -- Insecure Design
**Location:**
- Multiple API routes return `error.message` directly:
  - `app/src/app/api/projects/route.ts:191` -- `{ error: error.message }`
  - `app/src/app/api/projects/[id]/route.ts:114`
  - `app/src/app/api/comments/[id]/route.ts:48`
  - `app/src/app/api/screens/[id]/route.ts:86`
  - And others

**Description:**
Supabase/PostgreSQL error messages are passed directly to the client response. These messages can reveal database schema details, table names, constraint names, and internal structure, aiding an attacker in reconnaissance.

**Fix Recommendation:**
- Log the full error server-side.
- Return generic error messages to the client: `{ error: 'Internal server error' }`.
- In development, optionally include details.

---

### M-04: ENV Validation Does Not Enforce SESSION_SECRET

**Severity:** MEDIUM
**OWASP:** A05:2021 -- Security Misconfiguration
**Location:**
- `app/src/lib/env.ts:14-18`

**Description:**
The `validateEnv()` function only checks for Supabase environment variables (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`). It does not validate:
- `SESSION_SECRET` (critical for session security)
- `ADMIN_ID` / `ADMIN_PASSWORD`
- Minimum length requirements for `SESSION_SECRET`

In non-production mode, missing variables only produce a console warning (not an error), allowing the app to run with insecure defaults.

**Fix Recommendation:**
- Add `SESSION_SECRET`, `ADMIN_ID`, and `ADMIN_PASSWORD` to the required variables list.
- Enforce minimum length (32+ characters) for `SESSION_SECRET`.
- Throw in all environments if critical security variables are missing.

---

### M-05: No Request Body Size Limits on API Routes

**Severity:** MEDIUM
**OWASP:** A05:2021 -- Security Misconfiguration
**Location:**
- All POST/PATCH API routes that call `request.json()`

**Description:**
There are no explicit request body size limits on JSON API routes. While Next.js has a default body size limit (typically 1MB), there is no application-level enforcement. The screenshot upload endpoint does validate file type but does not explicitly enforce a maximum file size beyond the Supabase bucket limit (10MB in schema).

An attacker could send large payloads to consume memory and cause denial of service.

**Fix Recommendation:**
- Configure explicit body size limits in `next.config.ts`:
  ```ts
  experimental: { serverActions: { bodySizeLimit: '1mb' } }
  ```
- Validate and reject oversized text inputs (comment text, project names) at the application level.

---

## LOW Vulnerabilities

### L-01: No CORS Configuration

**Severity:** LOW
**OWASP:** A05:2021 -- Security Misconfiguration
**Location:**
- No CORS headers or configuration found anywhere in the codebase

**Description:**
There is no explicit CORS configuration. Next.js API routes in the same origin do not need CORS headers for same-origin requests. However, if the API is ever consumed by external clients or a separate frontend deployment, the default behavior (no CORS headers) will block legitimate cross-origin requests. More importantly, there is no explicit deny-list to prevent unintended cross-origin access if deployed behind a permissive reverse proxy.

**Fix Recommendation:**
- Explicitly configure CORS in middleware or `next.config.ts` headers to allowlist only the expected origins.
- This becomes critical if the frontend and API are ever deployed on different domains.

---

### L-02: `secure` Cookie Flag Only Set in Production

**Severity:** LOW
**OWASP:** A02:2021 -- Cryptographic Failures
**Location:**
- `app/src/lib/auth.ts:29` -- `secure: process.env.NODE_ENV === 'production'`

**Description:**
The `secure` flag on the session cookie is only set when `NODE_ENV === 'production'`. This is standard practice for local development over HTTP. However, if `NODE_ENV` is misconfigured in a staging or production environment, cookies will be transmitted over unencrypted connections.

**Fix Recommendation:**
- This is acceptable for development. Ensure production deployment always sets `NODE_ENV=production`.
- Consider also checking for HTTPS in the request URL as an additional safeguard.

---

### L-03: No Account Lockout After Repeated Failed Logins

**Severity:** LOW
**OWASP:** A07:2021 -- Identification and Authentication Failures
**Location:**
- `app/src/app/api/auth/login/route.ts`

**Description:**
While there is IP-based rate limiting (5 attempts per minute), there is no account-level lockout. An attacker using distributed IPs (botnets, proxies) can continue brute-forcing a specific account's password indefinitely without triggering the per-IP rate limit.

**Fix Recommendation:**
- Add account-level rate limiting (e.g., after 10 failed attempts for a specific `login_id`, lock the account temporarily or require CAPTCHA).
- Log failed login attempts for monitoring.

---

### L-04: Image URL From External Source Used in `<img>` Tag Without Next.js Image Optimization

**Severity:** LOW
**OWASP:** A08:2021 -- Software and Data Integrity Failures
**Location:**
- `app/src/app/client/projects/[id]/screens/page.tsx:124` -- `<img src={s.latest_version.image_url} ...>`

**Description:**
One instance uses a raw `<img>` tag instead of Next.js `<Image>` component for external URLs. While the `image_url` is stored in Supabase storage (trusted), using raw `<img>` bypasses Next.js image optimization and its built-in `remotePatterns` allowlist, which could be a concern if `image_url` values were ever tampered with in the database.

Other instances in the codebase correctly use the Next.js `<Image>` component.

**Fix Recommendation:**
- Replace the raw `<img>` tag with Next.js `<Image>` component for consistency and to benefit from the `remotePatterns` allowlist.

---

## Positive Security Observations

The following security practices are already well-implemented:

1. **HttpOnly session cookies** -- Session cookies are `httpOnly`, preventing JavaScript access (XSS cookie theft).
2. **SameSite: strict** -- Cookie `sameSite` is set to `strict`, providing strong CSRF protection.
3. **Iron-session encryption** -- Session data is encrypted using iron-session (AES-256), not just signed.
4. **Row-Level Security (RLS)** -- All Supabase tables have RLS enabled with service_role-only policies, preventing direct anon access.
5. **Server-side file type validation** -- Screenshot uploads validate magic bytes server-side, not just MIME type.
6. **Authorization checks on routes** -- Every API route individually checks `getSession()` and applies role-based access control.
7. **Project access control** -- Client users can only access projects they are assigned to, enforced at both project and screen level.
8. **No `dangerouslySetInnerHTML`** -- No raw HTML injection; React's default escaping handles XSS prevention in components.
9. **Supabase service_role isolation** -- The service role key is only used server-side; the client browser only receives the anon key.
10. **Database constraints** -- Proper CHECK constraints on text lengths, coordinate ranges, and status values.
11. **Audit logging** -- Status changes and edits are logged to an audit_log table.
12. **`.gitignore` covers `.env` files** -- Both root and app `.gitignore` exclude environment files.
13. **Storage bucket MIME restrictions** -- The Supabase storage bucket only allows image MIME types.

---

## Remediation Priority

| Priority | Issue | Effort |
|----------|-------|--------|
| **Immediate** | C-01: Remove hardcoded session secret fallback | Low |
| **Immediate** | C-03: Wire up middleware.ts properly | Low |
| **This Sprint** | C-02: Implement password hashing | Medium |
| **This Sprint** | H-05: Stop returning passwords in API responses | Low |
| **This Sprint** | H-01: Move admin accounts to database | Medium |
| **This Sprint** | H-02: Rotate Slack Bot Token | Low |
| **This Sprint** | H-04: Escape LIKE wildcards in search | Low |
| **Next Sprint** | H-03: Add CSRF defense-in-depth | Medium |
| **Next Sprint** | H-06: Switch to distributed rate limiter | Medium |
| **Next Sprint** | M-01: Add security headers | Low |
| **Next Sprint** | M-02: Validate UUID parameters | Low |
| **Next Sprint** | M-03: Sanitize error messages | Low |
| **Next Sprint** | M-04: Enforce SESSION_SECRET in env validation | Low |
| **Backlog** | M-05: Request body size limits | Low |
| **Backlog** | L-01 through L-04 | Low |
