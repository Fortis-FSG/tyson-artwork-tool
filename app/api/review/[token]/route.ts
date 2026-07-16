import { NextResponse } from "next/server";

import { findSessionByShareToken, toCustomerReviewPayload } from "@/lib/sessions";

export const runtime = "nodejs";

interface RouteContext {
  params: Promise<{ token: string }>;
}

export async function GET(_request: Request, context: RouteContext) {
  const { token } = await context.params;

  try {
    const session = await findSessionByShareToken(token);
    if (!session) {
      return NextResponse.json({ error: "Review link not found" }, { status: 404 });
    }

    return NextResponse.json({ review: await toCustomerReviewPayload(session) });
  } catch (error) {
    console.error("Failed to load customer review", error);
    return NextResponse.json({ error: "Failed to load review" }, { status: 500 });
  }
}
