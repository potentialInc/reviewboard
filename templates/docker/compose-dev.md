# Docker Compose Local Development Template

## Purpose

One-command local development environment: database, cache, storage, and app — all running together.

## Starter Compose File

```yaml
# docker-compose.dev.yml
services:
  # --- Database ---
  postgres:
    image: postgres:16-alpine
    ports: ["5432:5432"]
    environment:
      POSTGRES_USER: dev
      POSTGRES_PASSWORD: dev
      POSTGRES_DB: myapp_dev
    volumes:
      - postgres_data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U dev"]
      interval: 5s
      timeout: 5s
      retries: 5

  # --- Cache ---
  redis:
    image: redis:7-alpine
    ports: ["6379:6379"]
    volumes:
      - redis_data:/data
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 5s

  # --- Object Storage (S3-compatible) ---
  minio:
    image: minio/minio:latest
    ports:
      - "9000:9000"   # API
      - "9001:9001"   # Console
    environment:
      MINIO_ROOT_USER: minioadmin
      MINIO_ROOT_PASSWORD: minioadmin
    command: server /data --console-address ":9001"
    volumes:
      - minio_data:/data

  # --- Email Testing ---
  mailpit:
    image: axllent/mailpit:latest
    ports:
      - "8025:8025"   # Web UI
      - "1025:1025"   # SMTP
    environment:
      MP_MAX_MESSAGES: 500

volumes:
  postgres_data:
  redis_data:
  minio_data:
```

## Stack-Specific Variations

### Next.js + PostgreSQL + Redis

```env
# .env.development
DATABASE_URL=postgresql://dev:dev@localhost:5432/myapp_dev
REDIS_URL=redis://localhost:6379
S3_ENDPOINT=http://localhost:9000
S3_ACCESS_KEY=minioadmin
S3_SECRET_KEY=minioadmin
SMTP_HOST=localhost
SMTP_PORT=1025
```

### FastAPI + PostgreSQL

```yaml
# Add to docker-compose.dev.yml
services:
  api:
    build:
      context: .
      dockerfile: Dockerfile.dev
    ports: ["8000:8000"]
    environment:
      DATABASE_URL: postgresql://dev:dev@postgres:5432/myapp_dev
      REDIS_URL: redis://redis:6379
    depends_on:
      postgres: { condition: service_healthy }
      redis: { condition: service_healthy }
    volumes:
      - .:/app  # Hot reload
    command: uvicorn src.main:app --host 0.0.0.0 --port 8000 --reload
```

### MySQL Variant

Replace postgres service:
```yaml
  mysql:
    image: mysql:8.0
    ports: ["3306:3306"]
    environment:
      MYSQL_ROOT_PASSWORD: dev
      MYSQL_DATABASE: myapp_dev
      MYSQL_USER: dev
      MYSQL_PASSWORD: dev
    volumes:
      - mysql_data:/var/lib/mysql
```

### MongoDB Variant

```yaml
  mongo:
    image: mongo:7
    ports: ["27017:27017"]
    environment:
      MONGO_INITDB_ROOT_USERNAME: dev
      MONGO_INITDB_ROOT_PASSWORD: dev
    volumes:
      - mongo_data:/data/db
```

## Commands

```bash
# Start all services
docker compose -f docker-compose.dev.yml up -d

# View logs
docker compose -f docker-compose.dev.yml logs -f postgres

# Stop all
docker compose -f docker-compose.dev.yml down

# Reset (delete all data)
docker compose -f docker-compose.dev.yml down -v

# Check health
docker compose -f docker-compose.dev.yml ps
```

## Package.json Scripts

```json
{
  "scripts": {
    "dev:services": "docker compose -f docker-compose.dev.yml up -d",
    "dev:services:down": "docker compose -f docker-compose.dev.yml down",
    "dev:services:reset": "docker compose -f docker-compose.dev.yml down -v",
    "dev:services:logs": "docker compose -f docker-compose.dev.yml logs -f",
    "dev": "npm run dev:services && npm run dev:app",
    "dev:app": "next dev"
  }
}
```

## Service Access

| Service | URL | Credentials |
|---------|-----|-------------|
| PostgreSQL | `localhost:5432` | `dev / dev` |
| Redis | `localhost:6379` | (no auth) |
| MinIO Console | `http://localhost:9001` | `minioadmin / minioadmin` |
| MinIO API | `http://localhost:9000` | `minioadmin / minioadmin` |
| Mailpit UI | `http://localhost:8025` | (no auth) |
| Mailpit SMTP | `localhost:1025` | (no auth) |

## Rules

- Never use production credentials in docker-compose
- Always use `healthcheck` for services that other containers depend on
- Use named volumes for data persistence across restarts
- Add `docker-compose.dev.yml` to `.gitignore` if it contains secrets
- Include `.dockerignore` to keep images small
- Document required Docker version in README (Compose V2+)
