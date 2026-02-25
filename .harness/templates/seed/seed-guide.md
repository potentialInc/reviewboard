# Data Seeding Guide

## Purpose

Generate realistic demo/test data so non-developers can see a working application immediately after setup.

## Seed Data Tiers

| Tier | Purpose | When to Run |
|------|---------|------------|
| **Base** | Schema essentials (roles, categories, statuses) | Always — every environment |
| **Demo** | Realistic sample data for demos and manual testing | Development + staging |
| **Stress** | High-volume data for performance testing | Performance testing only |

## File Structure

```
src/repo/seeds/
├── base/
│   ├── 001-roles.seed.ts        # System roles
│   ├── 002-categories.seed.ts   # Lookup tables
│   └── 003-settings.seed.ts     # Default settings
├── demo/
│   ├── 010-users.seed.ts        # Demo users (admin, member, viewer)
│   ├── 020-content.seed.ts      # Sample content
│   └── 030-interactions.seed.ts # Comments, likes, activity
├── stress/
│   └── 100-bulk.seed.ts         # 10k+ records for load testing
└── index.ts                     # Seed runner
```

## Demo User Convention

Always create these users for consistent demo experience:

| Email | Password | Role | Purpose |
|-------|----------|------|---------|
| `admin@demo.com` | `demo1234` | admin | Full access testing |
| `user@demo.com` | `demo1234` | member | Standard user flow |
| `viewer@demo.com` | `demo1234` | viewer | Read-only access |

## Implementation Patterns

### Prisma Seed (`prisma/seed.ts`)

```typescript
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function seedBase() {
  await prisma.role.createMany({
    data: [
      { name: "admin", permissions: ["*"] },
      { name: "member", permissions: ["read", "write"] },
      { name: "viewer", permissions: ["read"] },
    ],
    skipDuplicates: true,
  });
}

async function seedDemo() {
  const hashedPassword = await bcrypt.hash("demo1234", 10);

  const users = [
    { email: "admin@demo.com", name: "Admin User", role: "admin" },
    { email: "user@demo.com", name: "Demo User", role: "member" },
    { email: "viewer@demo.com", name: "Viewer User", role: "viewer" },
  ];

  for (const user of users) {
    await prisma.user.upsert({
      where: { email: user.email },
      update: {},
      create: { ...user, hashedPassword },
    });
  }
}

async function main() {
  const tier = process.argv[2] || "demo";

  await seedBase();
  if (tier === "demo" || tier === "all") await seedDemo();

  console.log(`Seeded: ${tier}`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
```

### SQLAlchemy Seed (Python)

```python
# src/repo/seeds/demo.py
from src.config.database import SessionLocal
from src.types.models import User, Role
from passlib.context import CryptContext

pwd = CryptContext(schemes=["bcrypt"])

DEMO_USERS = [
    {"email": "admin@demo.com", "name": "Admin User", "role": "admin"},
    {"email": "user@demo.com", "name": "Demo User", "role": "member"},
    {"email": "viewer@demo.com", "name": "Viewer User", "role": "viewer"},
]

def seed_demo():
    db = SessionLocal()
    try:
        hashed = pwd.hash("demo1234")
        for u in DEMO_USERS:
            existing = db.query(User).filter_by(email=u["email"]).first()
            if not existing:
                db.add(User(**u, hashed_password=hashed))
        db.commit()
    finally:
        db.close()
```

## Package.json Scripts

```json
{
  "scripts": {
    "db:seed": "npx prisma db seed",
    "db:seed:base": "tsx prisma/seed.ts base",
    "db:seed:demo": "tsx prisma/seed.ts demo",
    "db:seed:stress": "tsx prisma/seed.ts stress",
    "db:reset": "npx prisma migrate reset"
  }
}
```

## Rules

- Seed scripts must be idempotent (safe to run multiple times)
- Use `upsert` or `skipDuplicates` to prevent duplicate errors
- Demo passwords are weak intentionally — never use in production
- Base seeds must never reference demo data
- Include timestamps that look realistic (spread across past 30 days)
- Generate realistic names/content (not "test1", "test2")
