# Monitoring & Observability Template

## Three Pillars

| Pillar | Tool Options | What It Captures |
|--------|-------------|-----------------|
| **Error Tracking** | Sentry, Bugsnag, Rollbar | Unhandled exceptions, stack traces |
| **Logging** | Pino, Winston, structlog | Structured application events |
| **Metrics** | Prometheus, DataDog, New Relic | Request latency, throughput, error rates |

## Recommended Stack by Project Size

| Size | Error Tracking | Logging | Metrics |
|------|---------------|---------|---------|
| MVP/Startup | Sentry (free tier) | Console + structured JSON | Vercel/Fly built-in |
| Growth | Sentry Pro | Pino → Loki/CloudWatch | Prometheus + Grafana |
| Enterprise | Sentry/DataDog | ELK Stack | DataDog/New Relic |

## Sentry Setup (Recommended Default)

### Next.js

```bash
npx @sentry/wizard@latest -i nextjs
```

This auto-configures:
- `sentry.client.config.ts`
- `sentry.server.config.ts`
- `sentry.edge.config.ts`
- `next.config.js` with Sentry webpack plugin

### Manual Config (`src/config/monitoring.ts`)

```typescript
import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  environment: process.env.NODE_ENV,
  tracesSampleRate: process.env.NODE_ENV === "production" ? 0.1 : 1.0,
  replaysSessionSampleRate: 0.1,
  replaysOnErrorSampleRate: 1.0,
});
```

### FastAPI

```bash
pip install sentry-sdk[fastapi]
```

```python
# src/config/monitoring.py
import sentry_sdk

def init_monitoring():
    sentry_sdk.init(
        dsn=os.environ["SENTRY_DSN"],
        environment=os.environ.get("ENV", "development"),
        traces_sample_rate=0.1 if os.environ.get("ENV") == "production" else 1.0,
    )
```

## Structured Logging

### Node.js (Pino)

```typescript
// src/config/logger.ts
import pino from "pino";

export const logger = pino({
  level: process.env.LOG_LEVEL || "info",
  transport:
    process.env.NODE_ENV === "development"
      ? { target: "pino-pretty" }
      : undefined,
  base: {
    service: process.env.SERVICE_NAME || "app",
    env: process.env.NODE_ENV,
  },
});

// Usage
logger.info({ userId, action: "login" }, "User logged in");
logger.error({ err, requestId }, "Request failed");
```

### Python (structlog)

```python
# src/config/logger.py
import structlog

structlog.configure(
    processors=[
        structlog.contextvars.merge_contextvars,
        structlog.processors.add_log_level,
        structlog.processors.TimeStamper(fmt="iso"),
        structlog.dev.ConsoleRenderer()
        if os.environ.get("ENV") == "development"
        else structlog.processors.JSONRenderer(),
    ],
)

logger = structlog.get_logger()

# Usage
logger.info("user_login", user_id=user_id)
logger.error("request_failed", error=str(e), request_id=request_id)
```

## Health Check Endpoint

Every service must expose a health check:

```typescript
// app/api/health/route.ts
import { NextResponse } from "next/server";

export async function GET() {
  const health = {
    status: "ok",
    timestamp: new Date().toISOString(),
    version: process.env.APP_VERSION || "unknown",
    checks: {
      database: await checkDatabase(),
      memory: process.memoryUsage().heapUsed < 512 * 1024 * 1024,
    },
  };

  const allHealthy = Object.values(health.checks).every(Boolean);
  return NextResponse.json(health, { status: allHealthy ? 200 : 503 });
}

async function checkDatabase(): Promise<boolean> {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return true;
  } catch {
    return false;
  }
}
```

## Environment Variables

```env
# Error Tracking
NEXT_PUBLIC_SENTRY_DSN=https://xxx@sentry.io/xxx
SENTRY_AUTH_TOKEN=sntrys_xxx  # Build-time only

# Logging
LOG_LEVEL=info               # debug, info, warn, error
SERVICE_NAME=my-app

# Metrics (if using Prometheus)
METRICS_PORT=9090
```

## Alert Rules (Recommended Defaults)

| Alert | Condition | Severity |
|-------|-----------|----------|
| Error spike | >10 errors/min (5x normal) | Critical |
| Latency | p95 > 2s for 5 minutes | Warning |
| Error rate | >5% of requests for 10 minutes | Critical |
| Memory | >80% heap usage | Warning |
| Disk | >90% usage | Critical |

## Rules

- Never log sensitive data (passwords, tokens, PII)
- Use structured logging (JSON) in production, pretty-print in development
- Include request ID in all log entries for tracing
- Health check must respond within 5 seconds
- Sample traces in production (10%) to control costs
- Error tracking must capture: stack trace, user context, request context
