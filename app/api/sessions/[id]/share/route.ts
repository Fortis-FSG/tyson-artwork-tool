import { NextResponse } from "next/server";

import { requireTeamAccess } from "@/lib/teamAuth";
import {
  ensureShareToken,
  hydrateSessionForClient,
  readSession,
} from "@/lib/sessions";

export const runtime = "nodejs";

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function POST(request: Request, context: RouteContext) {
  const denied = requireTeamAccess(request);
  if (denied) {
    return denied;
  }

  const { id } = await context.params;

  try {
    const session = await readSession(id);
    if (!session) {
      return NextResponse.json({ error: "Request not found" }, { status: 404 });
    }

    if (session.concepts.length === 0) {
      return NextResponse.json(
        { error: "Generate concepts before creating a customer review link." },
        { status: 400 },
      );
    }

    const shared = await ensureShareToken(session);
    const origin = new URL(request.url).origin;
    const reviewUrl = `${origin}/review/${shared.shareToken}`;

    return NextResponse.json({
      session: await hydrateSessionForClient(shared),
      reviewUrl,
      shareToken: shared.shareToken,
    });
  } catch (error) {
    console.error("Failed to create share link", error);
    return NextResponse.json({ error: "Failed to create share link" }, { status: 500 });
  }
}
