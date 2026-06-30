import { NextRequest, NextResponse } from "next/server";

import {
  buildConceptPrompts,
  getAspectRatioForSize,
  getParsedContext,
} from "@/lib/generatePrompt";
import { generateConceptImagesParallel } from "@/lib/xaiImage";
import type { GenerateImagesResponse } from "@/types";

export const maxDuration = 120;

interface GenerateImagesBody {
  emailText: string;
  hasScreenshot?: boolean;
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as GenerateImagesBody;
    const emailText = body.emailText?.trim();

    if (!emailText || emailText.length < 20) {
      return NextResponse.json(
        { error: "Email text is required (minimum 20 characters)." },
        { status: 400 },
      );
    }

    const hasScreenshot = Boolean(body.hasScreenshot);
    const prompts = buildConceptPrompts(emailText, hasScreenshot);
    const context = getParsedContext(emailText);
    const aspectRatio = getAspectRatioForSize(context.size);

    const results = await generateConceptImagesParallel(prompts, aspectRatio);

    const response: GenerateImagesResponse = {
      concepts: results.map((result) => ({
        id: `concept-${result.variant}-${Date.now()}`,
        imageDataUrl: result.dataUrl,
        prompt: result.prompt,
        variant: result.variant,
      })),
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error("Image generation error:", error);

    const message =
      error instanceof Error ? error.message : "Failed to generate concept images";

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
