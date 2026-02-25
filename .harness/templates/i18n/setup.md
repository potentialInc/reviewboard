# Internationalization (i18n) Setup Template

## Library Comparison

| Library | Framework | Key Feature |
|---------|-----------|-------------|
| **next-intl** | Next.js App Router | Server Components support, type-safe |
| **react-i18next** | React (any) | Most popular, flexible |
| **lingui** | React | Compile-time extraction, ICU syntax |
| **vue-i18n** | Vue.js | Official Vue integration |

## File Structure (next-intl)

```
src/
├── config/
│   └── i18n.ts              # i18n configuration
├── messages/
│   ├── en.json              # English (base)
│   ├── ko.json              # Korean
│   └── ja.json              # Japanese
├── middleware.ts             # Locale detection
└── app/
    └── [locale]/
        ├── layout.tsx       # Locale provider
        └── page.tsx
```

## next-intl Setup

### 1. Install

```bash
npm install next-intl
```

### 2. Config (`src/config/i18n.ts`)

```typescript
export const locales = ["en", "ko", "ja"] as const;
export type Locale = (typeof locales)[number];
export const defaultLocale: Locale = "en";
```

### 3. Message Files

```json
// src/messages/en.json
{
  "common": {
    "save": "Save",
    "cancel": "Cancel",
    "delete": "Delete",
    "loading": "Loading...",
    "error": "Something went wrong"
  },
  "auth": {
    "login": "Log in",
    "signup": "Sign up",
    "logout": "Log out",
    "email": "Email",
    "password": "Password"
  },
  "dashboard": {
    "title": "Dashboard",
    "welcome": "Welcome, {name}"
  }
}
```

```json
// src/messages/ko.json
{
  "common": {
    "save": "저장",
    "cancel": "취소",
    "delete": "삭제",
    "loading": "로딩 중...",
    "error": "문제가 발생했습니다"
  },
  "auth": {
    "login": "로그인",
    "signup": "회원가입",
    "logout": "로그아웃",
    "email": "이메일",
    "password": "비밀번호"
  },
  "dashboard": {
    "title": "대시보드",
    "welcome": "{name}님, 환영합니다"
  }
}
```

### 4. Middleware (`middleware.ts`)

```typescript
import createMiddleware from "next-intl/middleware";
import { locales, defaultLocale } from "@/config/i18n";

export default createMiddleware({
  locales,
  defaultLocale,
  localeDetection: true,
});

export const config = {
  matcher: ["/((?!api|_next|.*\\..*).*)"],
};
```

### 5. Usage in Components

```tsx
import { useTranslations } from "next-intl";

export function LoginForm() {
  const t = useTranslations("auth");

  return (
    <form>
      <label>{t("email")}</label>
      <input type="email" />
      <label>{t("password")}</label>
      <input type="password" />
      <button type="submit">{t("login")}</button>
    </form>
  );
}
```

### 6. Language Switcher

```tsx
"use client";
import { useLocale } from "next-intl";
import { useRouter, usePathname } from "next/navigation";
import { locales } from "@/config/i18n";

const labels: Record<string, string> = {
  en: "English",
  ko: "한국어",
  ja: "日本語",
};

export function LanguageSwitcher() {
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();

  function onChange(newLocale: string) {
    const newPath = pathname.replace(`/${locale}`, `/${newLocale}`);
    router.push(newPath);
  }

  return (
    <select value={locale} onChange={(e) => onChange(e.target.value)}>
      {locales.map((l) => (
        <option key={l} value={l}>{labels[l]}</option>
      ))}
    </select>
  );
}
```

## Translation Workflow

1. Developer adds English keys in `en.json`
2. Run extraction: `npx next-intl extract` (or manual)
3. Translate to target languages
4. PR review includes translation review

## Rules

- English is always the base/fallback language
- Use ICU message format for plurals and variables: `{count, plural, one {# item} other {# items}}`
- Namespace translations by feature (auth, dashboard, settings)
- Never hardcode user-facing strings — always use translation keys
- Keep message keys flat within namespaces (max 2 levels deep)
- Date/number formatting: use `Intl.DateTimeFormat` and `Intl.NumberFormat`
