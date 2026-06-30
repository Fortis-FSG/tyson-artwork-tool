import { XAI_MAX_REFERENCE_IMAGES } from "@/lib/referenceImages";

const XAI_GENERATIONS_URL = "https://api.x.ai/v1/images/generations";
const XAI_EDITS_URL = "https://api.x.ai/v1/images/edits";
const IMAGE_MODEL = "grok-imagine-image-quality";

export interface GenerateImageOptions {
  prompt: string;
  aspectRatio?: string;
  resolution?: "1k" | "2k";
  referenceImageUrls?: string[];
}

export interface GeneratedImageResult {
  dataUrl: string;
  revisedPrompt?: string;
}

interface XaiImageResponse {
  data?: Array<{
    b64_json?: string;
    url?: string;
    revised_prompt?: string;
  }>;
  error?: {
    message?: string;
  };
}

function getApiKey(): string {
  const apiKey = process.env.XAI_API_KEY;

  if (!apiKey) {
    throw new Error(
      "XAI_API_KEY is not configured. Add it to your environment variables.",
    );
  }

  return apiKey;
}

function parseImageResponse(data: XaiImageResponse): GeneratedImageResult {
  const imageData = data.data?.[0];

  if (!imageData?.b64_json) {
    throw new Error("No image data returned from xAI API");
  }

  return {
    dataUrl: `data:image/png;base64,${imageData.b64_json}`,
    revisedPrompt: imageData.revised_prompt,
  };
}

async function callXaiImageApi(
  url: string,
  body: Record<string, unknown>,
): Promise<GeneratedImageResult> {
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${getApiKey()}`,
    },
    body: JSON.stringify(body),
  });

  const data = (await response.json()) as XaiImageResponse;

  if (!response.ok) {
    throw new Error(
      data.error?.message ?? `xAI API error: ${response.status}`,
    );
  }

  return parseImageResponse(data);
}

export async function generateConceptImage(
  options: GenerateImageOptions,
): Promise<GeneratedImageResult> {
  const referenceUrls = (options.referenceImageUrls ?? []).slice(
    0,
    XAI_MAX_REFERENCE_IMAGES,
  );

  const basePayload = {
    model: IMAGE_MODEL,
    prompt: options.prompt,
    n: 1,
    response_format: "b64_json",
    aspect_ratio: options.aspectRatio ?? "4:3",
    resolution: options.resolution ?? "1k",
  };

  if (referenceUrls.length === 0) {
    return callXaiImageApi(XAI_GENERATIONS_URL, basePayload);
  }

  if (referenceUrls.length === 1) {
    return callXaiImageApi(XAI_EDITS_URL, {
      ...basePayload,
      image: {
        url: referenceUrls[0],
        type: "image_url",
      },
    });
  }

  return callXaiImageApi(XAI_EDITS_URL, {
    ...basePayload,
    images: referenceUrls.map((url) => ({
      url,
      type: "image_url",
    })),
  });
}

export async function generateConceptImagesParallel(
  prompts: { variant: number; prompt: string }[],
  aspectRatio: string,
  referenceImageUrls: string[] = [],
): Promise<Array<{ variant: number; dataUrl: string; prompt: string }>> {
  const refs = referenceImageUrls.slice(0, XAI_MAX_REFERENCE_IMAGES);

  const results = await Promise.allSettled(
    prompts.map(async ({ variant, prompt }) => {
      const result = await generateConceptImage({
        prompt,
        aspectRatio,
        referenceImageUrls: refs,
      });
      return { variant, dataUrl: result.dataUrl, prompt };
    }),
  );

  const successful = results
    .filter(
      (
        result,
      ): result is PromiseFulfilledResult<{
        variant: number;
        dataUrl: string;
        prompt: string;
      }> => result.status === "fulfilled",
    )
    .map((result) => result.value);

  if (successful.length === 0) {
    const firstError = results.find((r) => r.status === "rejected") as
      | PromiseRejectedResult
      | undefined;
    throw new Error(
      firstError?.reason instanceof Error
        ? firstError.reason.message
        : "All image generation requests failed",
    );
  }

  return successful.sort((a, b) => a.variant - b.variant);
}
