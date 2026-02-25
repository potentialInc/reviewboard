# Custom Domain & SSL Setup Template

## Platform-Specific Setup

### Vercel

```bash
# Add custom domain
vercel domains add myapp.com

# Add www redirect
vercel domains add www.myapp.com
```

DNS records:
```
Type  Name  Value
A     @     76.76.21.21
CNAME www   cname.vercel-dns.com
```

SSL: Automatic (Let's Encrypt), no configuration needed.

### Fly.io

```bash
# Add certificate
fly certs add myapp.com
fly certs add www.myapp.com

# Check status
fly certs show myapp.com
```

DNS records:
```
Type  Name  Value
A     @     <fly-app-ipv4>
AAAA  @     <fly-app-ipv6>
CNAME www   myapp.fly.dev
```

SSL: Automatic (Let's Encrypt via Fly).

### AWS (CloudFront + ACM)

```bash
# Request certificate in ACM (must be us-east-1 for CloudFront)
aws acm request-certificate \
  --domain-name myapp.com \
  --subject-alternative-names "*.myapp.com" \
  --validation-method DNS \
  --region us-east-1
```

DNS validation: Add the CNAME record from ACM to your DNS.

### Docker + Nginx + Let's Encrypt

```yaml
# docker-compose.yml
services:
  nginx:
    image: nginx:alpine
    ports: ["80:80", "443:443"]
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf
      - certbot-etc:/etc/letsencrypt
      - certbot-var:/var/lib/letsencrypt

  certbot:
    image: certbot/certbot
    volumes:
      - certbot-etc:/etc/letsencrypt
      - certbot-var:/var/lib/letsencrypt
    command: certonly --webroot --webroot-path=/var/www/html -d myapp.com -d www.myapp.com --agree-tos --email admin@myapp.com
```

Certificate renewal cron:
```bash
0 12 * * * docker compose run certbot renew --quiet
```

## DNS Provider Recommendations

| Provider | Best For | Free Tier |
|----------|---------|-----------|
| Cloudflare | CDN + DNS + DDoS protection | Yes |
| Route 53 | AWS-native | No ($0.50/zone) |
| Namecheap | Simple domain management | With domain purchase |

## SSL/TLS Checklist

- [ ] HTTPS enforced (HTTP → HTTPS redirect)
- [ ] HSTS header enabled (`Strict-Transport-Security: max-age=31536000`)
- [ ] TLS 1.2+ only (no TLS 1.0/1.1)
- [ ] Certificate auto-renewal configured
- [ ] www → apex (or apex → www) redirect configured
- [ ] Subdomain wildcard if needed (`*.myapp.com`)
