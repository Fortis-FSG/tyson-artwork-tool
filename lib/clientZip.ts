import JSZip from "jszip";

import { downloadBlob } from "@/lib/teamClient";
import { downloadDataUrl } from "@/lib/utils";
import type { GeneratedConcept } from "@/types";

async function imageToUint8Array(imageUrl: string): Promise<Uint8Array> {
  if (imageUrl.startsWith("data:")) {
    const base64 = imageUrl.split(",")[1] ?? "";
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
  }

  const response = await fetch(imageUrl);
  if (!response.ok) {
    throw new Error("Failed to fetch concept image");
  }
  return new Uint8Array(await response.arrayBuffer());
}

export async function downloadConceptsAsZip(options: {
  requestId: string;
  product: string | null;
  concepts: GeneratedConcept[];
  filename?: string;
}): Promise<void> {
  const zip = new JSZip();
  const { requestId, product, concepts } = options;

  await Promise.all(
    concepts.map(async (concept) => {
      const bytes = await imageToUint8Array(concept.imageDataUrl);
      zip.file(`concept-${concept.variant}.png`, bytes);
    }),
  );

  zip.file(
    "README.txt",
    [
      "Tyson Artwork Concept Review",
      `Request: ${requestId}`,
      product ? `Product: ${product}` : "Product: (see images)",
      "",
      "Please review the concept images in this ZIP.",
      "Reply with the concept number you approve (e.g. Concept 2).",
    ].join("\n"),
  );

  const blob = await zip.generateAsync({ type: "blob" });
  downloadBlob(blob, options.filename ?? `${requestId}-customer-review.zip`);
}

export async function downloadSelectedConcepts(
  concepts: GeneratedConcept[],
  requestId: string,
): Promise<void> {
  if (concepts.length === 1) {
    const concept = concepts[0];
    downloadDataUrl(
      concept.imageDataUrl,
      `${requestId}-concept-${concept.variant}.png`,
    );
    return;
  }

  await downloadConceptsAsZip({
    requestId,
    product: null,
    concepts,
    filename: `${requestId}-concepts.zip`,
  });
}
