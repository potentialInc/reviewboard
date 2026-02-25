# Code Review: ReviewBoard app/src/

**Reviewer**: Code Reviewer Agent
**Date**: 2026-02-25
**Scope**: All files under `app/src/`
**Branch**: main

---

## Blockers (must fix)

### B-01: Plaintext password storage and comparison
- **Severity**: BLOCKER
- **File**: `app/src/app/api/auth/login/route.ts:38`
- **Description**: Client passwords are stored in plaintext in the database and compared with a simple `===` equality check (`account.password !== password`). This is a fundamental security flaw. If the database is ever compromised, all client credentials are immediately exposed.
- **Suggestion**: Hash passwords using `bcrypt` or `argon2` before storing them. Replace the equality check with a constant-time hash comparison (e.g., `bcrypt.compare(password, account.password)`). Also update the project creation endpoint (`app/src/app/api/projects/route.ts:203`) which inserts the literal string `'Potential'` as the default password.

### B-02: Hardcoded default session secret in source code
- **Severity**: BLOCKER
- **File**: `app/src/lib/auth.ts:6`
- **Also**: `app/src/proxy.ts:4`
- **Description**: The session secret has a hardcoded fallback value: `'reviewboard-default-secret-change-in-production-32chars!'`. This value is duplicated in two files and is committed to source control. If `SESSION_SECRET` is not set in production, anyone who reads the source code can forge session tokens. The same secret string is duplicated in `proxy.ts`, violating DRY and increasing the surface area for mistakes.
- **Suggestion**: Remove the fallback entirely. Throw an error at startup if `SESSION_SECRET` is not set (add it to the `required` list in `app/src/lib/env.ts`). Extract the constant into a single shared config module so both `auth.ts` and `proxy.ts` reference the same value.

### B-03: Hardcoded default client password exposed in API response
- **Severity**: BLOCKER
- **File**: `app/src/app/api/projects/[id]/route.ts:85`
- **Description**: The GET endpoint returns `client_password: clientAcc?.password || 'Potential'` in the response body. This leaks the client's actual plaintext password to any authenticated admin user making an API call. Additionally, `app/src/app/api/projects/route.ts:203` hardcodes `password: 'Potential'` for every new client account, meaning all clients share the same initial password with no enforcement to change it.
- **Suggestion**: Never return passwords in API responses. Remove the `client_password` field from the project detail response. Implement a proper password reset/change flow rather than exposing credentials.

### B-04: SQL injection risk via unvalidated search parameter
- **Severity**: BLOCKER
- **File**: `app/src/app/api/feedback/route.ts:44`
- **Description**: The `search` query parameter is passed directly into `.ilike('text', `%${search}%`)`. While Supabase's client library does parameterize queries internally, the `%` wildcard wrapping is done via string interpolation. A malicious user can inject additional `%` and `_` wildcard characters to craft DoS-style broad queries. More importantly, the `search` value is not sanitized for length or content.
- **Suggestion**: Escape SQL LIKE special characters (`%`, `_`, `\`) in the search string before wrapping with `%`. Add a maximum length check on the search parameter (e.g., 200 characters).

### B-05: Missing `request.json()` error handling across all API routes
- **Severity**: BLOCKER
- **File**: `app/src/app/api/auth/login/route.ts:18`, `app/src/app/api/projects/route.ts:176`, `app/src/app/api/projects/[id]/route.ts:100`, `app/src/app/api/projects/[id]/screens/route.ts:16`, `app/src/app/api/comments/route.ts:11`, `app/src/app/api/comments/[id]/route.ts:15`, `app/src/app/api/comments/[id]/replies/route.ts:14`, `app/src/app/api/feedback/bulk/route.ts:12`
- **Description**: Every API route calls `await request.json()` without a try/catch. If a client sends a malformed body (e.g., invalid JSON, empty body, wrong content-type), this will throw an unhandled exception, resulting in an opaque 500 error.
- **Suggestion**: Wrap all `request.json()` calls in try/catch and return a `400 Bad Request` with a clear message like `"Invalid JSON body"`.

---

## Suggestions (should fix)

### S-01: In-memory rate limiter does not scale and leaks memory
- **Severity**: SUGGESTION
- **File**: `app/src/lib/rate-limit.ts:1-26`
- **Description**: The rate limiter uses a module-level `Map` that persists only in a single process. In a serverless environment (Vercel), each cold start gets a fresh Map, making the rate limiter ineffective. Additionally, expired entries are never cleaned up -- the Map will grow indefinitely since old keys are only overwritten when the same key is seen again.
- **Suggestion**: For production, use Redis or a Vercel KV store for rate limiting. At minimum, add a periodic cleanup mechanism (e.g., sweep expired entries on every Nth call) to prevent unbounded memory growth.

### S-02: Client-side project/screen filtering defeats server-side pagination
- **Severity**: SUGGESTION
- **File**: `app/src/app/api/feedback/route.ts:52-64`
- **Description**: The `project_id` and `screen_id` filters are applied in JavaScript AFTER fetching the paginated results from the database. This means if page 1 has 25 results but only 3 match the project filter, the client sees only 3 results even though there are more matching records on subsequent pages. The `total` count is also wrong since it reflects pre-filter count.
- **Suggestion**: Move the project/screen filtering into the database query. Since `screenshot_version_id` links to screens and projects, you can join and filter at the SQL level. Alternatively, use Supabase's nested filtering capabilities.

### S-03: Excessive `eslint-disable` comments for `@typescript-eslint/no-explicit-any`
- **Severity**: SUGGESTION
- **File**: `app/src/app/api/projects/[id]/route.ts:52,70`, `app/src/app/api/comments/route.ts:27,101-102`, `app/src/app/api/screens/[id]/route.ts:36,51-57`
- **Description**: Multiple files use `// eslint-disable-next-line @typescript-eslint/no-explicit-any` to suppress type errors from Supabase's nested relation returns. This masks potential runtime errors and reduces type safety.
- **Suggestion**: Define proper TypeScript interfaces for Supabase query results. You can use Supabase's generated types (`supabase gen types typescript`) to get type-safe query results. At minimum, define explicit interfaces for the shape of joined data.

### S-04: Duplicated open-feedback-count aggregation logic across routes
- **Severity**: SUGGESTION
- **File**: `app/src/app/api/projects/route.ts:34-79` (admin branch), `app/src/app/api/projects/route.ts:117-158` (client branch), `app/src/app/api/projects/[id]/route.ts:51-78`
- **Description**: The pattern of collecting screen IDs, fetching screenshot_versions, then counting open comments is repeated three times with nearly identical code (~40 lines each). This violates DRY and makes maintenance error-prone.
- **Suggestion**: Extract a shared utility function such as `getOpenFeedbackCounts(supabase, projectIds)` in a shared service module (e.g., `app/src/lib/services/feedback-stats.ts`).

### S-05: `validateEnv()` called at module scope in layout
- **Severity**: SUGGESTION
- **File**: `app/src/app/layout.tsx:5`
- **Description**: `validateEnv()` is called as a top-level side effect in the root layout module. In non-production mode, it only logs a warning and continues, which means the app runs with missing env vars and fails with confusing errors later. Additionally, `SESSION_SECRET` and `ADMIN_ID`/`ADMIN_PASSWORD` are not in the required list despite being critical.
- **Suggestion**: Add `SESSION_SECRET`, `ADMIN_ID`, and `ADMIN_PASSWORD` to the required env vars in `app/src/lib/env.ts`. Consider throwing in all environments (not just production) to fail fast.

### S-06: No input validation for coordinate values in comment creation
- **Severity**: SUGGESTION
- **File**: `app/src/app/api/comments/route.ts:12`
- **Description**: While the database has `check (x >= 0 and x <= 100)` constraints, the API route does not validate that `x` and `y` are numbers within the 0-100 range before attempting the insert. A string value or out-of-range number will produce a cryptic database error.
- **Suggestion**: Add server-side validation: confirm `x` and `y` are numbers between 0 and 100 before inserting. Return a clear `400` error on invalid coordinates.

### S-07: Admin projects page exceeds 300-line convention limit
- **Severity**: SUGGESTION
- **File**: `app/src/app/admin/projects/page.tsx` (356 lines), `app/src/app/admin/projects/[id]/page.tsx` (415 lines), `app/src/app/admin/feedback/page.tsx` (529 lines)
- **Description**: Per `docs/CONVENTIONS.md` and `architecture/ARCHITECTURE.md` Rule 4, files should be max 300 lines with one concern per file. Three page components significantly exceed this limit. The feedback page at 529 lines is the worst offender, combining table view, filter logic, detail modal, and reply functionality.
- **Suggestion**: Extract reusable sub-components. For example, `AdminFeedbackPage` could be split into `FeedbackTable`, `FeedbackFilters`, `FeedbackDetailModal`, and a custom `useFeedbackData` hook.

### S-08: `useEffect` dependencies and fetch patterns risk infinite loops
- **Severity**: SUGGESTION
- **File**: `app/src/app/admin/projects/page.tsx:50`
- **Description**: `fetchProjects` is defined as a non-memoized function inside the component but called in `useEffect(() => { fetchProjects(); }, [])`. The empty dependency array means it runs once, but ESLint's exhaustive-deps rule would flag this since `fetchProjects` references `toast` (which can change). Other pages like `AdminDashboard` (line 83) include `toast` in the dependency array of `useEffect`, which could trigger re-fetching if the toast function identity changes.
- **Suggestion**: Wrap `fetchProjects` in `useCallback` (as done correctly in some other pages) or use a ref for the toast function to avoid the stale-closure/infinite-loop risk. Be consistent across all pages.

### S-09: No file size limit enforced server-side for screenshot uploads
- **Severity**: SUGGESTION
- **File**: `app/src/app/api/projects/[id]/screens/[screenId]/screenshots/route.ts:30-34`
- **Description**: The file upload endpoint validates image type via magic bytes but does not enforce a maximum file size before processing. A malicious user could upload a very large file, consuming server memory. The database bucket has a 10MB limit, but the server still reads the entire file into memory before Supabase rejects it.
- **Suggestion**: Check `file.size` early in the handler and reject files exceeding a reasonable limit (e.g., 10MB) before reading the `arrayBuffer`.

### S-10: Bulk delete sends N parallel DELETE requests from client
- **Severity**: SUGGESTION
- **File**: `app/src/app/admin/projects/page.tsx:84-94`
- **Description**: The bulk delete handler fires `Promise.all` with individual DELETE requests for each selected project. This can overwhelm the server if many projects are selected and does not handle partial failures (if some deletes fail and others succeed).
- **Suggestion**: Create a dedicated bulk delete API endpoint (e.g., `DELETE /api/projects/bulk` with `{ ids: [...] }`) that handles the operation atomically, or at minimum use `Promise.allSettled` and report partial failures.

### S-11: Login page makes an API call to check authentication
- **Severity**: SUGGESTION
- **File**: `app/src/app/login/page.tsx:14-17`
- **Description**: The login page fires `fetch('/api/projects')` on mount to check if the user is already authenticated. This is an indirect and heavyweight way to check auth status (it fetches all projects). Additionally, the fetch error is silently caught, and a successful response triggers `window.location.href = '/'` which causes a full page reload.
- **Suggestion**: Create a lightweight `/api/auth/me` endpoint that returns session info, or use Next.js middleware to redirect authenticated users before the page renders.

### S-12: `createServiceSupabase` uses cookies unnecessarily
- **Severity**: SUGGESTION
- **File**: `app/src/lib/supabase/server.ts:29-52`
- **Description**: `createServiceSupabase` uses the service role key (which bypasses RLS) but still reads/writes cookies. The service role client does not need cookie-based auth since it has full database access. Calling `cookies()` in a service-role context is unnecessary overhead and can cause issues in contexts where cookies are not available.
- **Suggestion**: Use `createClient` from `@supabase/supabase-js` directly for the service role client, without the SSR cookie adapter.

### S-13: Dead link in login page
- **Severity**: SUGGESTION
- **File**: `app/src/app/login/page.tsx:120`
- **Description**: The "Are you an Admin? Login here" link points to `/admin/login`, but no such route exists in the app. There is no `app/src/app/admin/login/` page. The admin login is through the same `/login` page using admin credentials.
- **Suggestion**: Either remove this link or create the `/admin/login` route if needed.

### S-14: `projectFilter` state is tracked but never sent to the API
- **Severity**: SUGGESTION
- **File**: `app/src/app/admin/feedback/page.tsx:64,206-211`
- **Description**: The feedback page has a `projectFilter` state and a dropdown for selecting projects, but the selected value is never included in the API request query parameters (line 74-79). Additionally, the dropdown only has a single "All Projects" option with no mechanism to populate actual project options.
- **Suggestion**: Either remove the dead filter UI or implement it fully by fetching the project list and sending the filter to the API.

---

## Nitpicks (optional)

### N-01: Non-null assertions on environment variables
- **File**: `app/src/lib/supabase/client.ts:4-5`, `app/src/lib/supabase/server.ts:8-9,33-34`
- **Description**: `process.env.NEXT_PUBLIC_SUPABASE_URL!` uses the non-null assertion operator. If env vars are missing at runtime, this will fail with `undefined` rather than a clear error.
- **Suggestion**: Rely on the `validateEnv()` check at startup and/or use validated env constants from a shared config module.

### N-02: Inconsistent use of `next/image` vs raw `<img>` tags
- **File**: `app/src/app/client/projects/[id]/screens/page.tsx:123`
- **Description**: The client screen list page uses a raw `<img>` tag for screenshot images, while all other pages (admin project detail, feedback viewer, pin overlay) use Next.js `<Image>` component. This loses the optimization benefits (lazy loading, responsive sizing, WebP conversion).
- **Suggestion**: Replace with `<Image>` from `next/image` for consistency and performance.

### N-03: Console statements left in production code
- **File**: `app/src/lib/slack.ts:39,47,84,87`, `app/src/lib/env.ts:34`, `app/src/app/error.tsx:14`
- **Description**: Several `console.error` and `console.warn` calls exist in production library code. While useful during development, these can leak information in production logs.
- **Suggestion**: Use a structured logger that can be configured per environment.

### N-04: Unused import in admin projects page
- **File**: `app/src/app/admin/projects/page.tsx:5`
- **Description**: `Eye` is imported from `lucide-react` and used, but `Check` and `Copy` are also imported for the credentials modal. This is fine, but the entire file has a lot of imports (9 from lucide-react alone), suggesting the component does too much.
- **Suggestion**: This reinforces S-07 -- splitting into sub-components would naturally reduce import count per file.

### N-05: Breadcrumb component uses index as key
- **File**: `app/src/components/ui/breadcrumb.tsx:13`
- **Description**: `key={i}` uses array index as the React key. Since breadcrumb items are derived from static route data and don't reorder, this is safe but not ideal.
- **Suggestion**: Use `item.label` or a combination of `label+href` as key for clarity.

### N-06: Drawer component is never used
- **File**: `app/src/components/ui/drawer.tsx`
- **Description**: The `Drawer` component is defined but never imported or used anywhere in the codebase.
- **Suggestion**: Remove dead code or document its intended future use.

### N-07: Missing `aria-label` on several interactive elements
- **File**: `app/src/app/admin/projects/[id]/page.tsx:219-223` (filter/sort buttons), `app/src/app/admin/feedback/page.tsx:206,213` (filter dropdowns)
- **Description**: Some buttons (SlidersHorizontal, ArrowUpDown icons) have no `aria-label`, making them inaccessible to screen readers.
- **Suggestion**: Add descriptive `aria-label` attributes.

### N-08: Magic strings for routes scattered across components
- **File**: Various (e.g., `'/admin'`, `'/admin/projects'`, `'/client/projects'`, `'/login'`, `'/api/projects'`, etc.)
- **Description**: Route paths are hardcoded as string literals throughout the codebase. If a route changes, every reference must be manually updated.
- **Suggestion**: Consider a shared route constants file (e.g., `lib/routes.ts`) to centralize path definitions.

---

## Positive Observations

1. **Good auth middleware pattern**: The `proxy.ts` (middleware) correctly validates sessions for protected routes and provides role-based access control with proper redirects. The separation between page-level auth checks (in layouts) and API-level auth checks (in route handlers) provides defense in depth.

2. **Well-designed database schema**: The SQL schema in `schema.sql` has appropriate constraints (length limits, status enums, coordinate ranges), proper cascading deletes, composite indexes for common query patterns, and RLS enabled on all tables.

3. **Pin number race condition handling**: The comment creation endpoint (`app/src/app/api/comments/route.ts:46-86`) uses a retry loop to handle unique constraint violations when assigning pin numbers -- a thoughtful approach to concurrent feedback submissions.

4. **Server-side file type validation**: Screenshot uploads validate file magic bytes (`app/src/app/api/projects/[id]/screens/[screenId]/screenshots/route.ts:37-47`) rather than trusting the client-reported MIME type.

5. **Accessible UI components**: The Modal component implements focus trapping, Escape key handling, and proper ARIA attributes. The breadcrumb uses semantic `<nav>` with `aria-label`. Toast notifications use `aria-live="polite"`.

6. **Clean component library**: UI primitives (`Badge`, `Skeleton`, `Modal`, `Breadcrumb`, `Toast`) are well-encapsulated, reusable, and consistently styled using a coherent design token system in `globals.css`.

7. **Audit logging**: Status changes and edits on comments are logged to `audit_log` with old/new values and actor identification, enabling accountability.

---

## Summary

| Category | Assessment |
|----------|-----------|
| **Overall** | REQUEST_CHANGES |
| **Architecture** | PASS (with caveats) |
| **Tests** | INSUFFICIENT (no tests found under `app/src/`) |
| **Security** | FAIL (plaintext passwords, hardcoded secrets, password leakage) |
| **Code Quality** | GOOD (clean patterns, but DRY violations and oversized files) |
| **Error Handling** | NEEDS IMPROVEMENT (missing JSON parse guards, inconsistent error flows) |
| **Type Safety** | FAIR (multiple `any` escape hatches suppress type checking) |
| **Performance** | FAIR (client-side filtering defeats pagination, N+1 bulk deletes) |
| **Accessibility** | GOOD (most components have ARIA, with minor gaps) |

**Overall Quality Score: 6.5 / 10**

The application demonstrates solid architectural decisions (layered auth, audit logging, proper DB schema) and thoughtful UX (pin-based feedback, version history, toast notifications). However, three critical security issues -- plaintext passwords, hardcoded session secrets, and password leakage in API responses -- must be resolved before this code is production-ready. The absence of any test files under `app/src/` is also a significant concern for long-term maintainability. Addressing the 5 blockers and the top suggestions (especially S-01 through S-04) would bring this codebase to a strong production-ready state.
