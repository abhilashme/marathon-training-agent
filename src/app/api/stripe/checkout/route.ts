import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { createCheckoutSession, PLANS } from "@/lib/stripe/client";
import { z } from "zod";

const Schema = z.object({
  plan: z.enum(["race_prep_pack", "season_pass"]),
});

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id || !session.user.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const parsed = Schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid plan" }, { status: 400 });
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const checkoutSession = await createCheckoutSession(
    parsed.data.plan,
    session.user.id,
    session.user.email,
    `${appUrl}/dashboard?success=1&plan=${parsed.data.plan}`,
    `${appUrl}/pricing?cancelled=1`
  );

  return NextResponse.json({ url: checkoutSession.url });
}
