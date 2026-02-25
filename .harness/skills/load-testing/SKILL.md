# Load Testing Skill

Automated load and stress testing using k6 or Artillery. Inspired by Airbnb's Impulse load testing system.

## Concept

Load testing validates that the application handles expected (and peak) traffic without degradation. This skill provides templates for:

1. **Smoke test**: Minimal load, verify endpoints work (1-5 VUs)
2. **Load test**: Expected traffic levels (target VUs from PRD)
3. **Stress test**: Beyond expected limits to find breaking points
4. **Soak test**: Sustained load over time to detect memory leaks

## Directory Structure

```
tests/
├── load/
│   ├── k6/
│   │   ├── smoke.js            # Quick validation
│   │   ├── load.js             # Standard load test
│   │   ├── stress.js           # Break-point test
│   │   ├── soak.js             # Long-running stability
│   │   └── helpers/
│   │       ├── auth.js         # Auth token helper
│   │       └── config.js       # Shared config
│   ├── artillery/
│   │   ├── load.yml            # Artillery alternative config
│   │   └── processor.js        # Custom functions
│   └── LOAD_TEST_REPORT.md     # Results summary
```

## k6 Templates

### Config Helper

```javascript
// tests/load/k6/helpers/config.js
export const BASE_URL = __ENV.BASE_URL || "http://localhost:3000";
export const API_URL = `${BASE_URL}/api`;

export const THRESHOLDS = {
  http_req_duration: ["p(95)<500", "p(99)<1500"],  // 95th < 500ms, 99th < 1.5s
  http_req_failed: ["rate<0.01"],                    // < 1% error rate
  http_reqs: ["rate>100"],                           // > 100 req/s throughput
};

export const HEADERS = {
  "Content-Type": "application/json",
};
```

### Auth Helper

```javascript
// tests/load/k6/helpers/auth.js
import http from "k6/http";
import { BASE_URL, HEADERS } from "./config.js";

export function getAuthToken() {
  // Use demo credentials from templates/seed/seed-guide.md
  const res = http.post(`${BASE_URL}/api/auth/login`, JSON.stringify({
    email: "user@demo.com",
    password: "demo1234",
  }), { headers: HEADERS });

  return res.json("token") || res.json("accessToken") || "";
}

export function authHeaders(token) {
  return {
    ...HEADERS,
    Authorization: `Bearer ${token}`,
  };
}
```

### Smoke Test

```javascript
// tests/load/k6/smoke.js
import http from "k6/http";
import { check, sleep } from "k6";
import { BASE_URL, API_URL, HEADERS } from "./helpers/config.js";

export const options = {
  vus: 1,
  duration: "30s",
  thresholds: {
    http_req_duration: ["p(99)<1500"],
    http_req_failed: ["rate<0.01"],
  },
};

export default function () {
  // Health check
  const health = http.get(`${API_URL}/health`);
  check(health, {
    "health check status 200": (r) => r.status === 200,
  });

  // Public pages
  const home = http.get(BASE_URL);
  check(home, {
    "homepage loads": (r) => r.status === 200,
    "homepage fast": (r) => r.timings.duration < 1000,
  });

  sleep(1);
}
```

### Load Test

```javascript
// tests/load/k6/load.js
import http from "k6/http";
import { check, sleep } from "k6";
import { API_URL, THRESHOLDS } from "./helpers/config.js";
import { getAuthToken, authHeaders } from "./helpers/auth.js";

export const options = {
  stages: [
    { duration: "2m", target: 50 },   // Ramp up to 50 users
    { duration: "5m", target: 50 },   // Stay at 50 users
    { duration: "2m", target: 100 },  // Ramp to 100 users
    { duration: "5m", target: 100 },  // Stay at 100 users
    { duration: "2m", target: 0 },    // Ramp down
  ],
  thresholds: THRESHOLDS,
};

export function setup() {
  return { token: getAuthToken() };
}

export default function (data) {
  const headers = authHeaders(data.token);

  // API endpoints — customize per project
  const endpoints = [
    { method: "GET", url: `${API_URL}/users/me`, weight: 30 },
    { method: "GET", url: `${API_URL}/dashboard`, weight: 25 },
    { method: "GET", url: `${API_URL}/items?page=1&limit=20`, weight: 25 },
    { method: "GET", url: `${API_URL}/notifications`, weight: 20 },
  ];

  // Weighted random selection
  const total = endpoints.reduce((s, e) => s + e.weight, 0);
  let rand = Math.random() * total;
  let endpoint = endpoints[0];
  for (const ep of endpoints) {
    rand -= ep.weight;
    if (rand <= 0) { endpoint = ep; break; }
  }

  const res = http[endpoint.method.toLowerCase()](endpoint.url, null, { headers });
  check(res, {
    "status is 2xx": (r) => r.status >= 200 && r.status < 300,
    "response time < 500ms": (r) => r.timings.duration < 500,
  });

  sleep(Math.random() * 3 + 1); // 1-4s think time
}
```

### Stress Test

```javascript
// tests/load/k6/stress.js
import http from "k6/http";
import { check, sleep } from "k6";
import { API_URL, HEADERS } from "./helpers/config.js";
import { getAuthToken, authHeaders } from "./helpers/auth.js";

export const options = {
  stages: [
    { duration: "2m", target: 100 },   // Normal load
    { duration: "5m", target: 100 },
    { duration: "2m", target: 200 },   // Beyond normal
    { duration: "5m", target: 200 },
    { duration: "2m", target: 300 },   // Breaking point
    { duration: "5m", target: 300 },
    { duration: "5m", target: 0 },     // Recovery
  ],
  thresholds: {
    http_req_duration: ["p(95)<2000"],  // Relaxed for stress
    http_req_failed: ["rate<0.10"],      // Allow up to 10% errors under stress
  },
};

export function setup() {
  return { token: getAuthToken() };
}

export default function (data) {
  const headers = authHeaders(data.token);

  const res = http.get(`${API_URL}/dashboard`, { headers });
  check(res, {
    "still responding": (r) => r.status !== 0,
    "not server error": (r) => r.status < 500,
  });

  sleep(1);
}
```

## Artillery Alternative

```yaml
# tests/load/artillery/load.yml
config:
  target: "http://localhost:3000"
  phases:
    - duration: 120
      arrivalRate: 10
      name: "Warm up"
    - duration: 300
      arrivalRate: 50
      name: "Sustained load"
    - duration: 120
      arrivalRate: 0
      name: "Ramp down"
  defaults:
    headers:
      Content-Type: "application/json"
  ensure:
    p95: 500
    maxErrorRate: 1

scenarios:
  - name: "Browse flow"
    weight: 60
    flow:
      - get:
          url: "/api/health"
      - think: 1
      - get:
          url: "/api/items?page=1&limit=20"
      - think: 2

  - name: "Auth flow"
    weight: 40
    flow:
      - post:
          url: "/api/auth/login"
          json:
            email: "user@demo.com"
            password: "demo1234"
          capture:
            json: "$.token"
            as: "token"
      - get:
          url: "/api/users/me"
          headers:
            Authorization: "Bearer {{ token }}"
      - think: 3
```

## Running Tests

```bash
# k6
k6 run tests/load/k6/smoke.js                              # Quick check
k6 run tests/load/k6/load.js                               # Standard load
k6 run tests/load/k6/stress.js                             # Find breaking point
k6 run --env BASE_URL=https://staging.example.com tests/load/k6/load.js  # Against staging

# Artillery
npx artillery run tests/load/artillery/load.yml
npx artillery run --target https://staging.example.com tests/load/artillery/load.yml
```

## Performance Budgets

| Metric | Smoke | Load | Stress |
|--------|-------|------|--------|
| p95 response time | < 500ms | < 500ms | < 2000ms |
| p99 response time | < 1500ms | < 1500ms | < 5000ms |
| Error rate | < 0.1% | < 1% | < 10% |
| Throughput | > 10 req/s | > 100 req/s | measured |

## CI Integration

```yaml
# Run smoke test on every PR, full load test on staging deploys
- name: Load test (smoke)
  if: github.event_name == 'pull_request'
  run: |
    npm start &
    sleep 5
    k6 run tests/load/k6/smoke.js

- name: Load test (full)
  if: github.ref == 'refs/heads/staging'
  run: |
    k6 run --env BASE_URL=${{ secrets.STAGING_URL }} tests/load/k6/load.js
```

## Agent Integration

- **performance-agent** uses load test results to identify bottlenecks
- **devops-agent** integrates load tests into CI/CD pipeline
- **test-writer** agent generates endpoint list for load test scenarios
