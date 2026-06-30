const XAI_IMAGES_URL = "https://api.x.ai/v1/images/generations";
const IMAGE_MODEL = "grok-imagine-image-quality";

export interface GenerateImageOptions {
  prompt: string;
  aspectRatio?: string;
  resolution?: "1k" | "2k";
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

export async function generateConceptImage(
  options: GenerateImageOptions,
): Promise<GeneratedImageResult> {
  const response = await fetch(XAI_IMAGES_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${getApiKey()}`,
    },
    body: JSON.stringify({
      model: IMAGE_MODEL,
      prompt: options.prompt,
      n: 1,
      response_format: "b64_json",
      aspect_ratio: options.aspectRatio ?? "4:3",
      resolution: options.resolution ?? "1k",
    }),
  });

  const data = (await response.json()) as XaiImageResponse;

  if (!response.ok) {
    throw new Error(
      data.error?.message ?? `xAI API error: ${response.status}`,
    );
  }

  const imageData = data.data?.[0];

  if (!imageData?.b64_json) {
    throw new Error("No image data returned from xAI API");
  }

  return {
    dataUrl: `data:image/png;base64,${imageData.b64_json}`,
    revisedPrompt: imageData.revised_prompt,
  };
}

export async function generateConceptImagesParallel(
  prompts: { variant: number; prompt: string }[],
  aspectRatio: string,
): Promise<Array<{ variant: number; dataUrl: string; prompt: string }>> {
  const results = await Promise.allSettled(
    prompts.map(async ({ variant, prompt }) => {
      const result = await generateConceptImage({ prompt, aspectRatio });
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
