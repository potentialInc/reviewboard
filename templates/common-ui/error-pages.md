# Common UI Patterns: Error Pages & Empty States

## Required Pages

Every production app needs these boundary states:

| Page | Route | When Shown |
|------|-------|-----------|
| 404 Not Found | `/not-found` or catch-all | Invalid URL |
| 500 Server Error | `/error` | Unhandled server error |
| 403 Forbidden | inline or redirect | Insufficient permissions |
| Loading | component | Data fetching in progress |
| Empty State | component | No data yet |
| Offline | component | Network disconnected |

## File Structure

```
src/ui/
├── feedback/
│   ├── not-found-page.tsx       # 404 page
│   ├── error-page.tsx           # 500 page
│   ├── forbidden-page.tsx       # 403 page
│   ├── loading-spinner.tsx      # Loading indicator
│   ├── empty-state.tsx          # No data component
│   └── offline-banner.tsx       # Offline indicator
└── layouts/
    └── error-boundary.tsx       # React error boundary wrapper
```

## Implementation Patterns

### 404 Not Found (Next.js)

```tsx
// app/not-found.tsx
export default function NotFound() {
  return (
    <main className="flex min-h-screen items-center justify-center">
      <div className="text-center">
        <h1 className="text-6xl font-bold text-gray-300">404</h1>
        <p className="mt-4 text-xl text-gray-600">Page not found</p>
        <p className="mt-2 text-gray-500">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <a
          href="/"
          className="mt-6 inline-block rounded-lg bg-primary px-6 py-3 text-white"
        >
          Go home
        </a>
      </div>
    </main>
  );
}
```

### Error Boundary

```tsx
// src/ui/layouts/error-boundary.tsx
"use client";
import { Component, type ReactNode } from "react";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback || (
        <div className="flex min-h-[400px] items-center justify-center">
          <div className="text-center">
            <h2 className="text-2xl font-semibold text-gray-800">
              Something went wrong
            </h2>
            <p className="mt-2 text-gray-500">
              Please try refreshing the page.
            </p>
            <button
              onClick={() => this.setState({ hasError: false, error: null })}
              className="mt-4 rounded-lg bg-primary px-4 py-2 text-white"
            >
              Try again
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
```

### Empty State Component

```tsx
// src/ui/feedback/empty-state.tsx
interface EmptyStateProps {
  icon?: ReactNode;
  title: string;
  description: string;
  action?: { label: string; onClick: () => void };
}

export function EmptyState({ icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      {icon && <div className="mb-4 text-gray-300">{icon}</div>}
      <h3 className="text-lg font-medium text-gray-800">{title}</h3>
      <p className="mt-1 max-w-sm text-sm text-gray-500">{description}</p>
      {action && (
        <button
          onClick={action.onClick}
          className="mt-4 rounded-lg bg-primary px-4 py-2 text-sm text-white"
        >
          {action.label}
        </button>
      )}
    </div>
  );
}
```

### Loading Skeleton

```tsx
// src/ui/feedback/loading-spinner.tsx
export function LoadingSpinner({ size = "md" }: { size?: "sm" | "md" | "lg" }) {
  const sizeClass = { sm: "h-4 w-4", md: "h-8 w-8", lg: "h-12 w-12" }[size];
  return (
    <div className="flex items-center justify-center p-8">
      <div className={`${sizeClass} animate-spin rounded-full border-2 border-gray-200 border-t-primary`} />
    </div>
  );
}

export function Skeleton({ className = "" }: { className?: string }) {
  return (
    <div className={`animate-pulse rounded bg-gray-200 ${className}`} />
  );
}

export function CardSkeleton() {
  return (
    <div className="rounded-lg border p-4">
      <Skeleton className="mb-3 h-4 w-3/4" />
      <Skeleton className="mb-2 h-3 w-full" />
      <Skeleton className="h-3 w-1/2" />
    </div>
  );
}
```

## Empty State Messages (Copy Guide)

| Context | Title | Description |
|---------|-------|-------------|
| No items | No {items} yet | Create your first {item} to get started. |
| Search empty | No results found | Try adjusting your search or filters. |
| Filter empty | No matches | No {items} match the selected filters. |
| Error | Failed to load | Something went wrong. Please try again. |
| Permissions | Access restricted | You don't have permission to view this. |

## Rules

- Every page must handle loading, error, and empty states
- Never show a blank white screen — always show feedback
- Error messages should suggest a next action
- Use consistent visual patterns across all empty states
- Loading states should match the layout shape (skeleton)
- Accessibility: loading spinners need `aria-label="Loading"`
