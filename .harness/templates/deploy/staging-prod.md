# Staging to Production Deployment Template

## Environment Model

| Environment | Purpose | Branch | URL Pattern | Auto-deploy |
|-------------|---------|--------|-------------|-------------|
| **Development** | Local + feature branches | `feature/*` | `localhost:3000` | No |
| **Preview** | PR-specific ephemeral | PR branches | `pr-123.preview.app` | Yes (per PR) |
| **Staging** | Pre-production validation | `staging` | `staging.myapp.com` | Yes (on merge) |
| **Production** | Live users | `main` | `myapp.com` | Manual trigger |

## Promotion Flow

```
feature/* → PR → Review → Merge to main
                              ↓
                    Auto-deploy to Staging
                              ↓
                    QA validation on Staging
                              ↓
                    Manual promote to Production
                              ↓
                    Monitor for 30 minutes
                              ↓
                    Done (or rollback)
```

## GitHub Actions Workflow

```yaml
# .github/workflows/deploy.yml
name: Deploy

on:
  push:
    branches: [main]
  workflow_dispatch:
    inputs:
      environment:
        type: choice
        options: [staging, production]

jobs:
  deploy-staging:
    if: github.event_name == 'push' || github.event.inputs.environment == 'staging'
    runs-on: ubuntu-latest
    environment: staging
    steps:
      - uses: actions/checkout@v4
      - name: Deploy to Staging
        run: |
          # Platform-specific deploy command
          # Vercel: vercel --env staging
          # Fly: fly deploy --app myapp-staging
          # Docker: docker push registry/myapp:staging
          echo "Deploying to staging..."

  deploy-production:
    if: github.event.inputs.environment == 'production'
    runs-on: ubuntu-latest
    environment:
      name: production
      url: https://myapp.com
    needs: [deploy-staging]
    steps:
      - uses: actions/checkout@v4
      - name: Deploy to Production
        run: |
          echo "Deploying to production..."

      - name: Health Check
        run: |
          sleep 30
          STATUS=$(curl -s -o /dev/null -w "%{http_code}" https://myapp.com/api/health)
          if [ "$STATUS" != "200" ]; then
            echo "Health check failed! Rolling back..."
            # Platform-specific rollback
            exit 1
          fi
```

## Environment Variables per Stage

```env
# .env.staging
DATABASE_URL=postgres://user:pass@staging-db/myapp
NEXT_PUBLIC_API_URL=https://staging.myapp.com/api
SENTRY_ENVIRONMENT=staging

# .env.production
DATABASE_URL=postgres://user:pass@prod-db/myapp
NEXT_PUBLIC_API_URL=https://myapp.com/api
SENTRY_ENVIRONMENT=production
```

## Rollback Strategy

| Platform | Rollback Command |
|----------|-----------------|
| Vercel | `vercel rollback` (instant, previous deployment) |
| Fly.io | `fly releases rollback` |
| Docker/K8s | `kubectl rollout undo deployment/myapp` |
| AWS ECS | Previous task definition auto-retained |

## Pre-Production Checklist

- [ ] All tests passing on staging
- [ ] Database migrations applied successfully
- [ ] No new Sentry errors on staging
- [ ] Performance metrics within acceptable range
- [ ] Feature flags configured for gradual rollout
- [ ] Rollback plan documented and tested

## Rules

- Production deploys are always manual (never auto-deploy to prod)
- Every staging deploy must pass health check before promotion
- Keep staging and production configs identical except URLs/secrets
- Rollback must be possible within 5 minutes
- Database migrations must be backward-compatible (no breaking changes)
