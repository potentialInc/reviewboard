# Caching Strategy Template

## Cache Layers

```
Client (Browser) → CDN (Edge) → Server (App) → Database
   ↑ Cache L1        ↑ L2          ↑ L3           ↑ L4
   SWR/Query      Cloudflare    Redis/Memory    Query Cache
```

| Layer | Tool | TTL | What to Cache |
|-------|------|-----|--------------|
| **L1: Client** | React Query / SWR | 30s-5min | API responses, user data |
| **L2: CDN/Edge** | Cloudflare / Vercel Edge | 1min-1hr | Static assets, public pages |
| **L3: Server** | Redis / LRU Map | 5min-1hr | DB query results, computed data |
| **L4: Database** | Query planner cache | Auto | Prepared statements, query plans |

## L1: Client-Side Caching (React Query)

```typescript
// src/config/query-client.ts
import { QueryClient } from "@tanstack/react-query";

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30 * 1000,        // 30 seconds before refetch
      gcTime: 5 * 60 * 1000,       // 5 minutes in garbage collection
      retry: 2,
      refetchOnWindowFocus: false,
    },
  },
});
```

```typescript
// Usage in components
const { data } = useQuery({
  queryKey: ["users", userId],
  queryFn: () => fetchUser(userId),
  staleTime: 60 * 1000,  // Override: 1 minute for user data
});
```

## L2: CDN/Edge Caching

### Next.js ISR (Incremental Static Regeneration)

```typescript
// app/blog/[slug]/page.tsx
export const revalidate = 3600; // Revalidate every hour

// Or on-demand revalidation
// app/api/revalidate/route.ts
import { revalidatePath } from "next/cache";

export async function POST(request: Request) {
  const { path } = await request.json();
  revalidatePath(path);
  return Response.json({ revalidated: true });
}
```

### Cache-Control Headers

```typescript
// app/api/public-data/route.ts
export async function GET() {
  const data = await fetchPublicData();
  return Response.json(data, {
    headers: {
      "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400",
    },
  });
}
```

## L3: Server-Side Caching (Redis)

```typescript
// src/config/cache.ts
import { Redis } from "ioredis";

export const redis = new Redis(process.env.REDIS_URL!);

export async function cacheGet<T>(key: string): Promise<T | null> {
  const cached = await redis.get(key);
  return cached ? JSON.parse(cached) : null;
}

export async function cacheSet(key: string, value: unknown, ttlSeconds = 300) {
  await redis.set(key, JSON.stringify(value), "EX", ttlSeconds);
}

export async function cacheInvalidate(pattern: string) {
  const keys = await redis.keys(pattern);
  if (keys.length > 0) await redis.del(...keys);
}
```

```typescript
// src/service/product-service.ts
export async function getProduct(id: string) {
  const cacheKey = `product:${id}`;
  const cached = await cacheGet<Product>(cacheKey);
  if (cached) return cached;

  const product = await productRepo.findById(id);
  if (product) await cacheSet(cacheKey, product, 600); // 10 min
  return product;
}
```

## Cache Invalidation Patterns

| Pattern | When to Use | Example |
|---------|------------|---------|
| **TTL expiry** | Data can be slightly stale | Product listings (5min TTL) |
| **Write-through** | Must be consistent | User profile (update cache on write) |
| **Event-based** | Related data changes | Invalidate product cache on price update |
| **Tag-based** | Group invalidation | Invalidate all `user:123:*` keys |

## What NOT to Cache

- Authentication tokens (security risk)
- Rapidly changing data (real-time counters)
- User-specific data at CDN level (privacy)
- Large blobs (use object storage instead)

## Environment Variables

```env
REDIS_URL=redis://localhost:6379
CACHE_DEFAULT_TTL=300
```

## Rules

- Cache aggressively at the edge (CDN) for public content
- Use short TTLs (30s-5min) for user-specific data
- Always implement cache invalidation — stale data is worse than no cache
- Monitor cache hit rates (aim for >80%)
- Use cache keys that include version: `v1:product:123`
