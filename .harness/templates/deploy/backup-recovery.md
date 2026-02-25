# Backup & Recovery Template

## Backup Strategy

| Data Type | Frequency | Retention | Method |
|-----------|-----------|-----------|--------|
| **Database** | Daily + before migrations | 30 days | pg_dump / mysqldump / managed |
| **File uploads** | Real-time (sync) | Indefinite | S3 versioning / rsync |
| **Config/secrets** | On change | 90 days | Git (encrypted) / Vault |
| **Logs** | Continuous | 14-90 days | CloudWatch / Loki |

## Database Backup

### PostgreSQL (Managed — Supabase/RDS/Fly)

Most managed databases include automatic daily backups. Verify:

```bash
# Supabase: Check dashboard → Database → Backups
# AWS RDS: Automatic backups enabled by default (7-day retention)
# Fly Postgres: fly postgres backup list -a myapp-db
```

### PostgreSQL (Self-Managed)

```bash
#!/usr/bin/env bash
set -euo pipefail

# Daily backup script
DB_NAME="myapp"
BACKUP_DIR="/backups/postgres"
DATE=$(date +%Y%m%d_%H%M%S)
RETENTION_DAYS=30

mkdir -p "$BACKUP_DIR"

# Create compressed backup
pg_dump "$DB_NAME" | gzip > "$BACKUP_DIR/${DB_NAME}_${DATE}.sql.gz"

# Upload to S3
aws s3 cp "$BACKUP_DIR/${DB_NAME}_${DATE}.sql.gz" \
  "s3://myapp-backups/postgres/${DB_NAME}_${DATE}.sql.gz"

# Clean old local backups
find "$BACKUP_DIR" -name "*.sql.gz" -mtime +$RETENTION_DAYS -delete

echo "Backup complete: ${DB_NAME}_${DATE}.sql.gz"
```

### Pre-Migration Backup

```bash
# Always backup before migrations
#!/usr/bin/env bash
set -euo pipefail

echo "Creating pre-migration backup..."
pg_dump "$DATABASE_URL" | gzip > "/tmp/pre-migration-$(date +%Y%m%d_%H%M%S).sql.gz"
echo "Backup created. Running migration..."
npx prisma migrate deploy
```

## Recovery Procedures

### Database Restore

```bash
# From compressed backup
gunzip -c backup_20240101.sql.gz | psql "$DATABASE_URL"

# From S3
aws s3 cp s3://myapp-backups/postgres/backup_20240101.sql.gz /tmp/
gunzip -c /tmp/backup_20240101.sql.gz | psql "$DATABASE_URL"
```

### Managed Database Point-in-Time Recovery

```bash
# AWS RDS
aws rds restore-db-instance-to-point-in-time \
  --source-db-instance-identifier myapp-db \
  --target-db-instance-identifier myapp-db-restored \
  --restore-time "2024-01-15T10:30:00Z"

# Fly Postgres
fly postgres backup restore -a myapp-db --backup-id <id>
```

## GitHub Actions: Automated Backup

```yaml
# .github/workflows/backup.yml
name: Database Backup
on:
  schedule:
    - cron: "0 3 * * *"  # Daily at 3 AM UTC
  workflow_dispatch:

jobs:
  backup:
    runs-on: ubuntu-latest
    steps:
      - name: Backup Database
        env:
          DATABASE_URL: ${{ secrets.DATABASE_URL }}
          AWS_ACCESS_KEY_ID: ${{ secrets.AWS_ACCESS_KEY_ID }}
          AWS_SECRET_ACCESS_KEY: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
        run: |
          pg_dump "$DATABASE_URL" | gzip > backup.sql.gz
          aws s3 cp backup.sql.gz \
            "s3://myapp-backups/postgres/$(date +%Y%m%d).sql.gz"
```

## Recovery Time Objectives

| Scenario | Target | Method |
|----------|--------|--------|
| Accidental data deletion | < 1 hour | Point-in-time restore |
| Database corruption | < 2 hours | Latest daily backup |
| Complete infrastructure loss | < 4 hours | Backup + IaC redeploy |

## Rules

- Test restore procedure monthly (don't just back up — verify restores work)
- Pre-migration backups are mandatory, not optional
- Never store backup credentials in code
- Encrypt backups at rest (S3 SSE, GPG for manual backups)
- Document restore steps for each team member
