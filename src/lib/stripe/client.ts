import Stripe from "stripe";

let _stripe: Stripe | null = null;
export function getStripe(): Stripe {
  if (!_stripe) {
    _stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
      apiVersion: "2026-03-25.dahlia",
    });
  }
  return _stripe;
}

// Keep backward compat alias — only accessed at runtime when env is set
export const stripe = new Proxy({} as Stripe, {
  get(_target, prop) {
    return (getStripe() as unknown as Record<string | symbol, unknown>)[prop];
  },
});

export const PLANS = {
  race_prep_pack: {
    name: "Race Prep Pack",
    description: "Full training plan + race week brief for a single event",
    price: 2400, // cents
    priceId: process.env.STRIPE_RACE_PREP_PACK_PRICE_ID!,
    mode: "payment" as const,
  },
  season_pass: {
    name: "Season Pass",
    description: "Unlimited races + weekly adaptive coaching",
    price: 1000, // cents/month
    priceId: process.env.STRIPE_SEASON_PASS_PRICE_ID!,
    mode: "subscription" as const,
  },
};

export async function createCheckoutSession(
  plan: keyof typeof PLANS,
  userId: string,
  userEmail: string,
  successUrl: string,
  cancelUrl: string
): Promise<Stripe.Checkout.Session> {
  const planConfig = PLANS[plan];

  // Get or create Stripe customer
  const { prisma } = await import("@/lib/prisma");
  const user = await prisma.user.findUnique({ where: { id: userId } });

  let customerId = user?.stripeCustomerId;
  if (!customerId) {
    const customer = await stripe.customers.create({
      email: userEmail,
      metadata: { userId },
    });
    customerId = customer.id;
    await prisma.user.update({
      where: { id: userId },
      data: { stripeCustomerId: customerId },
    });
  }

  return stripe.checkout.sessions.create({
    customer: customerId,
    mode: planConfig.mode,
    line_items: [{ price: planConfig.priceId, quantity: 1 }],
    success_url: successUrl,
    cancel_url: cancelUrl,
    metadata: { userId, plan },
    allow_promotion_codes: true,
  });
}

export async function createBillingPortalSession(
  customerId: string,
  returnUrl: string
): Promise<Stripe.BillingPortal.Session> {
  return stripe.billingPortal.sessions.create({
    customer: customerId,
    return_url: returnUrl,
  });
}
