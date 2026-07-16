import { NextResponse } from "next/server";

import { findSessionByShareToken, writeSession } from "@/lib/sessions";

export const runtime = "nodejs";

interface RouteContext {
  params: Promise<{ token: string }>;
}

export async function POST(request: Request, context: RouteContext) {
  const { token } = await context.params;

  try {
    const body = (await request.json()) as {
      conceptId?: string;
      comment?: string;
    };

    if (!body.conceptId) {
      return NextResponse.json({ error: "conceptId is required" }, { status: 400 });
    }

    const session = await findSessionByShareToken(token);
    if (!session) {
      return NextResponse.json({ error: "Review link not found" }, { status: 404 });
    }

    const concept = session.concepts.find((item) => item.id === body.conceptId);
    if (!concept) {
      return NextResponse.json({ error: "Concept not found" }, { status: 400 });
    }

    const updated = await writeSession({
      ...session,
      customerApprovedConceptId: concept.id,
      customerComment: body.comment?.trim() || null,
      status: "customer_approved",
      selectedConceptId: session.selectedConceptId ?? concept.id,
    });

    return NextResponse.json({
      ok: true,
      approvedConceptId: updated.customerApprovedConceptId,
      comment: updated.customerComment,
    });
  } catch (error) {
    console.error("Failed to approve concept", error);
    return NextResponse.json({ error: "Failed to submit approval" }, { status: 500 });
  }
}
