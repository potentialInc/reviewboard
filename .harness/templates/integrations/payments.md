# Payment Integration Template

## Provider Comparison

| Provider | Best For | Fees | Setup |
|----------|---------|------|-------|
| **Stripe** | Global SaaS, subscriptions | 2.9% + $0.30 | API keys |
| **Toss Payments** | Korean market | 2.8% ~ 3.5% | API keys + 가맹점 |
| **PayPal** | International buyers | 2.9% + $0.30 | API keys |
| **Paddle** | SaaS (MoR, handles tax) | 5% + $0.50 | Dashboard |

## File Structure (Stripe Example)

```
src/
├── types/
│   └── payment.ts           # Price, Subscription, Invoice types
├── config/
│   └── stripe.ts            # Stripe client initialization
├── service/
│   └── payment-service.ts   # Checkout, subscription, webhook logic
└── runtime/
    └── routes/
        ├── checkout.ts       # Create checkout session
        └── webhooks/
            └── stripe.ts     # Webhook handler
```

## Stripe Implementation

### Config (`src/config/stripe.ts`)

```typescript
import Stripe from "stripe";

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2024-12-18.acacia",
});
```

### Checkout Session (`src/service/payment-service.ts`)

```typescript
import { stripe } from "@/config/stripe";

export async function createCheckoutSession(params: {
  priceId: string;
  userId: string;
  successUrl: string;
  cancelUrl: string;
}) {
  return stripe.checkout.sessions.create({
    mode: "subscription",
    payment_method_types: ["card"],
    line_items: [{ price: params.priceId, quantity: 1 }],
    success_url: params.successUrl,
    cancel_url: params.cancelUrl,
    client_reference_id: params.userId,
    metadata: { userId: params.userId },
  });
}

export async function createCustomerPortalSession(customerId: string) {
  return stripe.billingPortal.sessions.create({
    customer: customerId,
    return_url: `${process.env.NEXT_PUBLIC_APP_URL}/settings/billing`,
  });
}
```

### Webhook Handler (`app/api/webhooks/stripe/route.ts`)

```typescript
import { stripe } from "@/config/stripe";
import { headers } from "next/headers";

export async function POST(request: Request) {
  const body = await request.text();
  const signature = (await headers()).get("stripe-signature")!;

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(
      body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET!
    );
  } catch (err) {
    return new Response("Webhook signature verification failed", { status: 400 });
  }

  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object as Stripe.Checkout.Session;
      await handleCheckoutComplete(session);
      break;
    }
    case "customer.subscription.updated":
    case "customer.subscription.deleted": {
      const subscription = event.data.object as Stripe.Subscription;
      await handleSubscriptionChange(subscription);
      break;
    }
    case "invoice.payment_failed": {
      const invoice = event.data.object as Stripe.Invoice;
      await handlePaymentFailed(invoice);
      break;
    }
  }

  return new Response("OK", { status: 200 });
}
```

### Environment Variables

```env
STRIPE_SECRET_KEY=sk_test_xxx
STRIPE_PUBLISHABLE_KEY=pk_test_xxx
STRIPE_WEBHOOK_SECRET=whsec_xxx
STRIPE_PRICE_ID_PRO=price_xxx
STRIPE_PRICE_ID_TEAM=price_xxx
```

## Pricing Table Component

```tsx
interface PricingPlan {
  name: string;
  price: number;
  priceId: string;
  features: string[];
  popular?: boolean;
}

const plans: PricingPlan[] = [
  {
    name: "Free",
    price: 0,
    priceId: "",
    features: ["5 projects", "Basic support"],
  },
  {
    name: "Pro",
    price: 19,
    priceId: "price_xxx",
    features: ["Unlimited projects", "Priority support", "Analytics"],
    popular: true,
  },
];
```

## Security Checklist

- [ ] Webhook signature verification on every request
- [ ] Secret keys never exposed to client (use publishable key only)
- [ ] Idempotency keys for payment creation
- [ ] Webhook endpoint excludes CSRF protection
- [ ] Test mode keys in development, live keys in production only
- [ ] PCI compliance: never handle raw card numbers (use Stripe Elements)
