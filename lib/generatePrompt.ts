import { parseEmailText } from "@/lib/parseEmail";
import type { ParsedEmailContext } from "@/types";

const SYSTEM_PROMPT = `You are a senior prepress designer creating professional Tyson/Walmart private-label packaging concepts.
Output must look like a real printed label mockup — flat, print-ready, not cartoonish or 3D rendered.
Use clean typography, accurate spot-color appearance, proper margins, and realistic label proportions.
Include barcode/2D matrix areas when specified. Match Tyson brand standards: bold product hierarchy, regulatory copy zones, and retail-ready layout.`;

const VARIANT_DIRECTIONS = [
  {
    variant: 1,
    direction:
      "Classic centered hierarchy: brand lockup top, bold product name center, supporting claims below, barcode zone bottom-right.",
  },
  {
    variant: 2,
    direction:
      "Left-aligned modern layout: logo left, stacked product title and claims on right, color band accent, barcode bottom-left.",
  },
  {
    variant: 3,
    direction:
      "Premium retail layout: full-width header band, large hero product name, ingredient/nutrition callout panel, barcode centered bottom.",
  },
  {
    variant: 4,
    direction:
      "Compact efficient layout: horizontal logo + product lockup, minimal copy blocks, strong color blocking, barcode with quiet zone bottom-right.",
  },
];

function buildSpecsBlock(context: ParsedEmailContext): string {
  const lines: string[] = [
    "LABEL SPECIFICATIONS:",
    `- Customer: ${context.customer ?? "Tyson Foods / Walmart private label"}`,
    `- Request type: ${context.requestType ?? "Artwork request"}`,
    `- Label size: ${context.size ?? '3.7" x 3.01" (standard Tyson WM rapid mock)'}`,
    `- Material: ${context.material ?? "White BOPP or specified substrate"}`,
    `- Unwind: ${context.unwind ?? "As specified / #1 or #2"}`,
    `- Roll qty: ${context.rollQty ?? "Per PO"}`,
  ];

  if (context.referenceNumber) {
    lines.push(`- Reference #: ${context.referenceNumber}`);
  }

  if (context.product) {
    lines.push(`- Product: ${context.product}`);
  }

  if (context.spotColors.length > 0) {
    lines.push(`- Spot colors (PMS): ${context.spotColors.join(", ")}`);
  } else {
    lines.push("- Spot colors: Tyson brand reds/yellows + black + white (match reference if provided)");
  }

  if (context.barcodeRequirements) {
    lines.push(`- Barcode: ${context.barcodeRequirements}`);
  } else {
    lines.push("- Barcode: Include 2D matrix / GS1 DataMatrix area with proper quiet zone");
  }

  if (context.layoutInstructions) {
    lines.push(`- Layout notes: ${context.layoutInstructions}`);
  }

  if (context.notes.length > 0) {
    lines.push("- Special instructions:");
    context.notes.forEach((note) => lines.push(`  • ${note}`));
  }

  return lines.join("\n");
}

function buildUserPrompt(
  context: ParsedEmailContext,
  emailText: string,
  variantDirection: string,
  hasScreenshot: boolean,
): string {
  const emailExcerpt = emailText.trim().slice(0, 2000);

  return `${SYSTEM_PROMPT}

Create a single professional packaging LABEL CONCEPT mockup (flat front-facing label design, not a product photo on a shelf).

${buildSpecsBlock(context)}

DESIGN DIRECTION FOR THIS CONCEPT:
${variantDirection}

SOURCE EMAIL (extract all relevant details):
"""
${emailExcerpt}
"""

${hasScreenshot ? "A reference email screenshot was provided — mimic the referenced artwork style, typography feel, and layout cues from the attached reference file mentioned in the email." : "Follow typical Tyson/Walmart private-label label conventions."}

REQUIREMENTS:
- Photorealistic flat label artwork mockup on neutral background
- Correct approximate label aspect ratio for the specified dimensions
- Professional print design quality suitable for prepress review
- Include placeholder regulatory text areas where appropriate
- No watermarks, no cartoon style, no 3D product renders
- Show clear color separation appearance for spot colors`;
}

export function buildConceptPrompts(
  emailText: string,
  hasScreenshot: boolean,
): { variant: number; prompt: string }[] {
  const context = parseEmailText(emailText);

  return VARIANT_DIRECTIONS.map(({ variant, direction }) => ({
    variant,
    prompt: buildUserPrompt(context, emailText, direction, hasScreenshot),
  }));
}

export function getAspectRatioForSize(size: string | null): string {
  if (!size) {
    return "4:3";
  }

  const match = size.match(/(\d+(?:\.\d+)?)\s*[x×]\s*(\d+(?:\.\d+)?)/i);
  if (!match) {
    return "4:3";
  }

  const width = parseFloat(match[1]);
  const height = parseFloat(match[2]);
  const ratio = width / height;

  if (ratio > 1.4) {
    return "16:9";
  }

  if (ratio > 1.1) {
    return "4:3";
  }

  if (ratio > 0.9) {
    return "1:1";
  }

  return "3:4";
}

export function getParsedContext(emailText: string): ParsedEmailContext {
  return parseEmailText(emailText);
}
