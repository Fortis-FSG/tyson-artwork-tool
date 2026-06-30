import { NextRequest, NextResponse } from "next/server";

import { generateOutput } from "@/lib/generateOutput";
import type { GeneratedConcept } from "@/types";

interface GenerateOutputBody {
  emailText: string;
  selectedConcept: GeneratedConcept;
  referenceImageNames?: string[];
  attachmentContext?: string;
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as GenerateOutputBody;

    if (!body.emailText?.trim()) {
      return NextResponse.json({ error: "Email text is required." }, { status: 400 });
    }

    if (!body.selectedConcept?.imageDataUrl) {
      return NextResponse.json({ error: "Selected concept is required." }, { status: 400 });
    }

    const output = generateOutput(
      body.emailText,
      body.selectedConcept,
      body.referenceImageNames ?? [],
      body.attachmentContext ?? "",
    );

    return NextResponse.json(output);
  } catch (error) {
    console.error("Output generation error:", error);

    const message =
      error instanceof Error ? error.message : "Failed to generate output";

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
