import { NextResponse } from "next/server";

import { requireTeamAccess } from "@/lib/teamAuth";
import {
  hydrateSessionForClient,
  listSessions,
  readSession,
  writeSession,
} from "@/lib/sessions";
import { generateRequestId } from "@/lib/utils";
import type { SavedRequest } from "@/types";

export const runtime = "nodejs";

function blobErrorMessage(error: unknown, fallback: string): string {
  const message = error instanceof Error ? error.message : "";
  if (message.includes("private store") || message.includes("public access")) {
    return "Blob store is private — the app must use private access. Redeploy the latest code, or create a public Blob store.";
  }
  if (message.toLowerCase().includes("token") || message.includes("Unauthorized")) {
    return "Blob auth failed. Check BLOB_READ_WRITE_TOKEN / BLOB_STORE_ID on Vercel.";
  }
  return fallback;
}

export async function GET(request: Request) {
  const denied = requireTeamAccess(request);
  if (denied) {
    return denied;
  }

  try {
    const sessions = await listSessions();
    return NextResponse.json({ sessions });
  } catch (error) {
    console.error("Failed to list sessions", error);
    return NextResponse.json(
      { error: blobErrorMessage(error, "Failed to list saved requests.") },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  const denied = requireTeamAccess(request);
  if (denied) {
    return denied;
  }

  try {
    const body = (await request.json()) as Partial<SavedRequest>;
    const id = body.id?.trim() || generateRequestId();
    const existing = await readSession(id);
    const now = new Date().toISOString();

    const session: SavedRequest = {
      id,
      status: body.status ?? existing?.status ?? "draft",
      step: body.step ?? existing?.step ?? "input",
      emailText: body.emailText ?? existing?.emailText ?? "",
      attachmentContext: body.attachmentContext ?? existing?.attachmentContext ?? "",
      product: body.product ?? existing?.product ?? null,
      customer: body.customer ?? existing?.customer ?? null,
      referenceNumber: body.referenceNumber ?? existing?.referenceNumber ?? null,
      urgency: body.urgency ?? existing?.urgency ?? "standard",
      concepts: body.concepts ?? existing?.concepts ?? [],
      referenceImages: body.referenceImages ?? existing?.referenceImages ?? [],
      selectedConceptId: body.selectedConceptId ?? existing?.selectedConceptId ?? null,
      customerApprovedConceptId:
        body.customerApprovedConceptId ?? existing?.customerApprovedConceptId ?? null,
      customerComment: body.customerComment ?? existing?.customerComment ?? null,
      artworkRequest: body.artworkRequest ?? existing?.artworkRequest ?? null,
      designBrief: body.designBrief ?? existing?.designBrief ?? "",
      shareToken: body.shareToken ?? existing?.shareToken ?? null,
      createdAt: existing?.createdAt ?? body.createdAt ?? now,
      updatedAt: now,
    };

    const saved = await writeSession(session);
    const hydrated = await hydrateSessionForClient(saved);
    return NextResponse.json({ session: hydrated });
  } catch (error) {
    console.error("Failed to save session", error);
    return NextResponse.json(
      { error: blobErrorMessage(error, "Failed to save request.") },
      { status: 500 },
    );
  }
}
