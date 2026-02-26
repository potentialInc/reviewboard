# Security Practices

Security guidelines for projects built with claude-harness.

## Secret Management

### Never Commit Secrets

The following should **never** appear in source code:

- API keys and tokens
- Database passwords
- JWT secrets
- Private keys
- Connection strings with credentials

### Use Environment Variables

```bash
# .env (gitignored — never committed)
DATABASE_URL=postgresql://user:pass@localhost:5432/mydb
API_SECRET=sk_live_abc123

# .env.example (committed — template without real values)
DATABASE_URL=postgresql://user:password@localhost:5432/dbname
API_SECRET=your_api_secret_here
```

### Setup

```bash
# Initialize env files for your stack
./harness/env-manager.sh init

# Verify all required vars are set
./harness/env-manager.sh check
```

### CI/CD Secrets

- Store secrets in GitHub Secrets (Settings → Secrets → Actions)
- Reference as `${{ secrets.MY_SECRET }}` in workflows
- Never echo or log secret values

## Pre-Edit Security Hook

The harness includes `hooks/pre-edit-security-check.sh` that scans for:

- AWS access keys (`AKIA...`)
- Hardcoded API keys and tokens
- Hardcoded passwords
- JWT tokens
- Private key blocks
- Database connection strings with credentials

This runs automatically before every file write.

## Code Security

### Input Validation

Always validate user input at system boundaries:

```typescript
// Good: Validate at the API boundary
const schema = z.object({
  email: z.string().email(),
  name: z.string().min(1).max(100),
});

// Bad: Trust user input
const user = { email: req.body.email, name: req.body.name };
```

### SQL Injection Prevention

Always use parameterized queries:

```typescript
// Good: Parameterized query
const user = await db.query('SELECT * FROM users WHERE id = $1', [userId]);

// Bad: String concatenation
const user = await db.query(`SELECT * FROM users WHERE id = ${userId}`);
```

### Authentication

- Hash passwords with bcrypt (cost factor >= 12)
- Use short-lived JWT tokens (15 min access, 7 day refresh)
- Implement rate limiting on auth endpoints
- Never store plain-text passwords

### CORS Configuration

```typescript
// Good: Explicit origins
cors({ origin: ['https://myapp.com', 'https://staging.myapp.com'] })

// Bad: Wildcard in production
cors({ origin: '*' })
```

### Security Headers

Ensure these headers are set in production:

| Header | Value | Purpose |
|--------|-------|---------|
| `X-Content-Type-Options` | `nosniff` | Prevent MIME sniffing |
| `X-Frame-Options` | `DENY` | Prevent clickjacking |
| `Strict-Transport-Security` | `max-age=31536000` | Force HTTPS |
| `Content-Security-Policy` | App-specific | Prevent XSS |

## Dependency Security

### Regular Scanning

```bash
# Node.js
npm audit

# Python
pip-audit

# Go
govulncheck ./...

# Or use the harness security agent
secure: scan dependencies for vulnerabilities
```

### CI Integration

The `claude-security-scan.yml` workflow runs weekly scans automatically. If vulnerabilities are found, it creates a GitHub issue with details.

## Security Agent

Use the security agent for comprehensive audits:

```
secure: audit the authentication system
secure: scan for OWASP Top 10 vulnerabilities
secure: review input validation on all API endpoints
```

The security agent checks:
1. Dependency vulnerabilities
2. Hardcoded secrets
3. Authentication/authorization flows
4. Input validation
5. CORS and security headers
6. SQL injection risks

## Reporting Security Issues

If you discover a security vulnerability in the harness itself:

1. Do **not** create a public issue
2. Document the vulnerability privately
3. Fix and test before disclosing
4. Update `memory/MISTAKES.md` with the pattern to prevent recurrence
