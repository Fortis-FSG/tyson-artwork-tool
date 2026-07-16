import { NextResponse } from "next/server";

import { requireTeamAccess } from "@/lib/teamAuth";
import { deleteSession, hydrateSessionForClient, readSession } from "@/lib/sessions";

export const runtime = "nodejs";

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function GET(request: Request, context: RouteContext) {
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
    return NextResponse.json({ session: await hydrateSessionForClient(session) });
  } catch (error) {
    console.error("Failed to load session", error);
    return NextResponse.json({ error: "Failed to load request" }, { status: 500 });
  }
}

export async function DELETE(request: Request, context: RouteContext) {
  const denied = requireTeamAccess(request);
  if (denied) {
    return denied;
  }

  const { id } = await context.params;

  try {
    await deleteSession(id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Failed to delete session", error);
    return NextResponse.json({ error: "Failed to delete request" }, { status: 500 });
  }
}
