# Email & Notification Template

## Provider Comparison

| Provider | Type | Free Tier | Best For |
|----------|------|-----------|---------|
| **Resend** | Transactional email | 100/day | React Email templates |
| **SendGrid** | Transactional + marketing | 100/day | High volume |
| **AWS SES** | Transactional | 62k/month (from EC2) | AWS infrastructure |
| **Postmark** | Transactional | 100/month | Deliverability |

## File Structure

```
src/
├── types/
│   └── notification.ts       # Email/notification types
├── config/
│   └── email.ts              # Email client config
├── service/
│   └── notification-service.ts  # Send logic + templates
└── ui/
    └── emails/               # React Email templates (optional)
        ├── welcome.tsx
        ├── reset-password.tsx
        └── invoice.tsx
```

## Resend Implementation (Recommended)

### Config (`src/config/email.ts`)

```typescript
import { Resend } from "resend";

export const resend = new Resend(process.env.RESEND_API_KEY);

export const EMAIL_FROM = "MyApp <noreply@myapp.com>";
```

### Notification Service (`src/service/notification-service.ts`)

```typescript
import { resend, EMAIL_FROM } from "@/config/email";

interface SendEmailParams {
  to: string;
  subject: string;
  html: string;
}

export async function sendEmail({ to, subject, html }: SendEmailParams) {
  const { data, error } = await resend.emails.send({
    from: EMAIL_FROM,
    to,
    subject,
    html,
  });

  if (error) throw new Error(`Email failed: ${error.message}`);
  return data;
}

export async function sendWelcomeEmail(email: string, name: string) {
  return sendEmail({
    to: email,
    subject: "Welcome to MyApp",
    html: `
      <h1>Welcome, ${name}!</h1>
      <p>Thanks for joining MyApp. Here's how to get started:</p>
      <ol>
        <li>Complete your profile</li>
        <li>Create your first project</li>
        <li>Invite your team</li>
      </ol>
      <a href="${process.env.NEXT_PUBLIC_APP_URL}/dashboard">
        Go to Dashboard
      </a>
    `,
  });
}

export async function sendPasswordResetEmail(email: string, token: string) {
  const resetUrl = `${process.env.NEXT_PUBLIC_APP_URL}/reset-password?token=${token}`;
  return sendEmail({
    to: email,
    subject: "Reset your password",
    html: `
      <p>Click the link below to reset your password:</p>
      <a href="${resetUrl}">Reset Password</a>
      <p>This link expires in 1 hour.</p>
      <p>If you didn't request this, ignore this email.</p>
    `,
  });
}
```

## Push Notifications (Web)

### Service Worker Registration

```typescript
// src/service/push-service.ts
export async function registerPushNotifications() {
  if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
    return null;
  }

  const registration = await navigator.serviceWorker.register("/sw.js");
  const subscription = await registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY,
  });

  // Send subscription to backend
  await fetch("/api/push/subscribe", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(subscription),
  });

  return subscription;
}
```

## Notification Events to Implement

| Event | Channel | Priority |
|-------|---------|----------|
| Welcome / signup | Email | High |
| Password reset | Email | High |
| Payment confirmation | Email | High |
| New comment/reply | Email + Push | Medium |
| Weekly digest | Email | Low |
| System announcement | Email + In-app | Medium |

## Environment Variables

```env
# Email
RESEND_API_KEY=re_xxx
EMAIL_FROM=noreply@myapp.com

# Push Notifications (VAPID keys)
NEXT_PUBLIC_VAPID_PUBLIC_KEY=xxx
VAPID_PRIVATE_KEY=xxx
```

## Rules

- Never send emails synchronously in request handlers (use background jobs)
- Rate limit email sending to avoid provider bans
- Include unsubscribe link in all marketing emails (CAN-SPAM compliance)
- Template emails in code (not hardcoded HTML strings in services)
- Log all sent emails for debugging (without PII in logs)
- Test with provider's test mode before going live
