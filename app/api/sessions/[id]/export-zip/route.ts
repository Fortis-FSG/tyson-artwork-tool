import { NextResponse } from "next/server";

import { requireTeamAccess } from "@/lib/teamAuth";
import { readSession } from "@/lib/sessions";
import { buildConceptsZipBuffer } from "@/lib/zipExport";

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

    let conceptIds: string[] | null = null;
    try {
      const body = (await request.json()) as { conceptIds?: string[] };
      conceptIds = body.conceptIds ?? null;
    } catch {
      conceptIds = null;
    }

    const concepts =
      conceptIds && conceptIds.length > 0
        ? session.concepts.filter((concept) => conceptIds.includes(concept.id))
        : session.concepts;

    if (concepts.length === 0) {
      return NextResponse.json({ error: "No concepts to export" }, { status: 400 });
    }

    const zipBuffer = await buildConceptsZipBuffer({
      requestId: session.id,
      product: session.product,
      concepts,
      includeReadme: true,
    });

    return new NextResponse(new Uint8Array(zipBuffer), {
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="${session.id}-customer-review.zip"`,
      },
    });
  } catch (error) {
    console.error("Failed to export zip", error);
    return NextResponse.json({ error: "Failed to export ZIP" }, { status: 500 });
  }
}
