import { NextRequest, NextResponse } from "next/server";
import { stripe } from "@/lib/stripe/client";
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";
import Stripe from "stripe";

export async function POST(req: NextRequest) {
  const body = await req.text();
  const sig = req.headers.get("stripe-signature");

  if (!sig) return NextResponse.json({ error: "No signature" }, { status: 400 });

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, sig, process.env.STRIPE_WEBHOOK_SECRET!);
  } catch {
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  // Idempotency check
  const existing = await prisma.webhookEvent.findUnique({
    where: { provider_eventId: { provider: "stripe", eventId: event.id } },
  });
  if (existing?.processedAt) {
    return NextResponse.json({ status: "already_processed" });
  }

  await prisma.webhookEvent.upsert({
    where: { provider_eventId: { provider: "stripe", eventId: event.id } },
    create: {
      provider: "stripe",
      eventId: event.id,
      eventType: event.type,
      payload: event as unknown as Prisma.InputJsonValue,
    },
    update: {},
  });

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        const userId = session.metadata?.userId;
        const plan = session.metadata?.plan;

        if (userId && plan) {
          if (session.mode === "payment") {
            // One-time Race Prep Pack
            await prisma.user.update({
              where: { id: userId },
              data: { subscriptionPlan: plan, subscriptionStatus: "active" },
            });
          }
          // Subscription handled by subscription.created event
        }
        break;
      }

      case "customer.subscription.created":
      case "customer.subscription.updated": {
        const sub = event.data.object as Stripe.Subscription;
        const customer = await stripe.customers.retrieve(sub.customer as string);
        if (customer.deleted) break;

        const userId = (customer as Stripe.Customer).metadata?.userId;
        if (!userId) break;

        await prisma.user.update({
          where: { id: userId },
          data: {
            subscriptionId: sub.id,
            subscriptionStatus: sub.status,
            subscriptionPlan: "season_pass",
            subscriptionPeriodEnd: new Date(((sub as unknown as Record<string, number>).current_period_end ?? 0) * 1000),
          },
        });
        break;
      }

      case "customer.subscription.deleted": {
        const sub = event.data.object as Stripe.Subscription;
        const customer = await stripe.customers.retrieve(sub.customer as string);
        if (customer.deleted) break;

        const userId = (customer as Stripe.Customer).metadata?.userId;
        if (!userId) break;

        await prisma.user.update({
          where: { id: userId },
          data: { subscriptionStatus: "canceled", subscriptionId: null },
        });
        break;
      }
    }
  } catch (err) {
    console.error("Webhook processing error:", err);
    return NextResponse.json({ error: "Processing failed" }, { status: 500 });
  }

  await prisma.webhookEvent.update({
    where: { provider_eventId: { provider: "stripe", eventId: event.id } },
    data: { processedAt: new Date() },
  });

  return NextResponse.json({ status: "ok" });
}
