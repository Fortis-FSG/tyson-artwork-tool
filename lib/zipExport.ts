import JSZip from "jszip";

import { fetchImageBytes } from "@/lib/sessions";
import type { GeneratedConcept } from "@/types";

export function buildCustomerReadme(requestId: string, product: string | null): string {
  const productLine = product ? `Product: ${product}` : "Product: (see images)";
  return [
    "Tyson Artwork Concept Review",
    `Request: ${requestId}`,
    productLine,
    "",
    "Please review the concept images in this ZIP.",
    "Reply with the concept number you approve (e.g. Concept 2).",
    "",
    "Files:",
    "- concept-1.png",
    "- concept-2.png",
    "- concept-3.png",
    "- concept-4.png",
    "  (only included concepts are present)",
  ].join("\n");
}

export async function buildConceptsZip(options: {
  requestId: string;
  product: string | null;
  concepts: GeneratedConcept[];
  includeReadme?: boolean;
}): Promise<Blob> {
  const zip = new JSZip();
  const { requestId, product, concepts, includeReadme = true } = options;

  await Promise.all(
    concepts.map(async (concept) => {
      const bytes = await fetchImageBytes(concept.imageDataUrl);
      zip.file(`concept-${concept.variant}.png`, bytes);
    }),
  );

  if (includeReadme) {
    zip.file("README.txt", buildCustomerReadme(requestId, product));
  }

  return zip.generateAsync({ type: "blob" });
}

export async function buildConceptsZipBuffer(options: {
  requestId: string;
  product: string | null;
  concepts: GeneratedConcept[];
  includeReadme?: boolean;
}): Promise<Buffer> {
  const blob = await buildConceptsZip(options);
  return Buffer.from(await blob.arrayBuffer());
}
