import { NextRequest, NextResponse } from "next/server";

import { estimateDataUrlBytes } from "@/lib/compressImage";
import {
  buildConceptPrompts,
  getAspectRatioForSize,
  getParsedContext,
} from "@/lib/generatePrompt";
import {
  MAX_API_IMAGE_BYTES,
  MAX_REFERENCE_IMAGES,
  XAI_MAX_REFERENCE_IMAGES,
} from "@/lib/referenceImages";
import { generateConceptImagesParallel } from "@/lib/xaiImage";
import type { GenerateImagesResponse, UploadedReferenceImage } from "@/types";

export const maxDuration = 120;

interface GenerateImagesBody {
  emailText: string;
  referenceImages?: UploadedReferenceImage[];
  attachmentContext?: string;
}

function validateReferenceImages(
  images: UploadedReferenceImage[] | undefined,
): UploadedReferenceImage[] {
  if (!images?.length) {
    return [];
  }

  if (images.length > MAX_REFERENCE_IMAGES) {
    throw new Error(`Maximum of ${MAX_REFERENCE_IMAGES} reference images allowed.`);
  }

  for (const image of images) {
    if (!image.dataUrl?.startsWith("data:image/")) {
      throw new Error(`Invalid image data for "${image.name}".`);
    }

    const approximateBytes = estimateDataUrlBytes(image.dataUrl);

    if (approximateBytes > MAX_API_IMAGE_BYTES) {
      throw new Error(
        `"${image.name}" is too large after processing. Try a smaller source file.`,
      );
    }
  }

  return images;
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

    const referenceImages = validateReferenceImages(body.referenceImages);
    const attachmentContext = body.attachmentContext?.trim() ?? "";

    const prompts = buildConceptPrompts(
      emailText,
      referenceImages.map(({ name }) => ({ name })),
      attachmentContext,
    );
    const context = getParsedContext(emailText);
    const aspectRatio = getAspectRatioForSize(context.size);

    const referenceImageUrls = referenceImages
      .slice(0, XAI_MAX_REFERENCE_IMAGES)
      .map((image) => image.dataUrl);

    const results = await generateConceptImagesParallel(
      prompts,
      aspectRatio,
      referenceImageUrls,
    );

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
