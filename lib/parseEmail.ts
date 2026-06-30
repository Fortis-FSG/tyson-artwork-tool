import type { ParsedEmailContext, Urgency } from "@/types";

const PMS_COLOR_PATTERN =
  /PMS\s*(\d{1,4}(?:\s*[A-Z])?(?:\s*C)?)|Pantone\s*(\d{1,4})/gi;

const SIZE_PATTERN =
  /(\d+(?:\.\d+)?)\s*[x×]\s*(\d+(?:\.\d+)?)\s*(?:"|''|in|inch|inches)?/gi;

const REFERENCE_PATTERN =
  /(?:ref(?:erence)?(?:\s*(?:#|no\.?|number))?|job\s*#?|po\s*#?|request\s*#?)\s*[:\-]?\s*([A-Z0-9\-]+)/i;

const CUSTOMER_PATTERNS = [
  /(?:customer|client|account|brand)\s*[:\-]\s*([^\n\r,]+)/i,
  /(?:for|from)\s+(Tyson(?:\s+Foods)?|Walmart|WM|Sam'?s Club)/i,
];

const URGENCY_PATTERNS: Array<{ pattern: RegExp; urgency: Urgency }> = [
  { pattern: /\b(rush|urgent|asap|immediate|priority|expedite)\b/i, urgency: "rush" },
  { pattern: /\b(urgent!|critical)\b/i, urgency: "urgent" },
];

const REQUEST_TYPE_PATTERNS = [
  { pattern: /rapid\s*mock/i, type: "Rapid Mock Request" },
  { pattern: /new\s*artwork/i, type: "New Artwork Request" },
  { pattern: /revision|revise/i, type: "Artwork Revision" },
  { pattern: /reprint|re-order/i, type: "Reprint Request" },
  { pattern: /mock\s*up|mockup/i, type: "Mockup Request" },
];

const MATERIAL_PATTERN =
  /(?:material|substrate|stock)\s*[:\-]?\s*([^\n\r]+)/i;

const UNWIND_PATTERN =
  /(?:unwind|wind direction|winding)\s*[:\-]?\s*([^\n\r]+)/i;

const ROLL_QTY_PATTERN =
  /(?:roll\s*qty|roll\s*quantity|quantity|qty)\s*[:\-]?\s*([^\n\r]+)/i;

const BARCODE_PATTERN =
  /(?:barcode|2d\s*matrix|datamatrix|qr\s*code|upc|gtin)[^\n\r]*/i;

const LAYOUT_PATTERN =
  /(?:layout|placement|position|copy|text\s*block|logo\s*placement)[^\n\r]*/i;

const PRODUCT_PATTERN =
  /(?:product|item|sku|description)\s*[:\-]\s*([^\n\r]+)/i;

function firstMatch(text: string, pattern: RegExp): string | null {
  const match = text.match(pattern);
  return match?.[1]?.trim() ?? null;
}

function extractSizes(text: string): string[] {
  const sizes: string[] = [];
  const regex = new RegExp(SIZE_PATTERN.source, "gi");
  let match: RegExpExecArray | null;

  while ((match = regex.exec(text)) !== null) {
    sizes.push(`${match[1]}" x ${match[2]}"`);
  }

  return [...new Set(sizes)];
}

function extractPmsColors(text: string): string[] {
  const colors: string[] = [];
  const regex = new RegExp(PMS_COLOR_PATTERN.source, "gi");
  let match: RegExpExecArray | null;

  while ((match = regex.exec(text)) !== null) {
    const code = match[1] ?? match[2];
    if (code) {
      colors.push(`PMS ${code.trim()}`);
    }
  }

  return [...new Set(colors)];
}

function extractCustomer(text: string): string | null {
  for (const pattern of CUSTOMER_PATTERNS) {
    const match = text.match(pattern);
    if (match?.[1]) {
      return match[1].trim();
    }
  }

  if (/tyson/i.test(text)) {
    return "Tyson Foods";
  }

  if (/\bWM\b|Walmart/i.test(text)) {
    return "Walmart";
  }

  return null;
}

function extractUrgency(text: string): Urgency {
  for (const { pattern, urgency } of URGENCY_PATTERNS) {
    if (pattern.test(text)) {
      return urgency;
    }
  }

  return "standard";
}

function extractRequestType(text: string): string | null {
  for (const { pattern, type } of REQUEST_TYPE_PATTERNS) {
    if (pattern.test(text)) {
      return type;
    }
  }

  return "Artwork Request";
}

function extractNotes(text: string): string[] {
  const notes: string[] = [];
  const lines = text.split(/\n+/).map((line) => line.trim()).filter(Boolean);

  const noteKeywords = [
    "mimic",
    "match",
    "reference",
    "attached",
    "please",
    "note",
    "ensure",
    "include",
    "do not",
    "must",
    "ai file",
    ".ai",
  ];

  for (const line of lines) {
    if (noteKeywords.some((keyword) => line.toLowerCase().includes(keyword))) {
      notes.push(line);
    }
  }

  return notes.slice(0, 8);
}

export function parseEmailText(emailText: string): ParsedEmailContext {
  const normalized = emailText.trim();
  const sizes = extractSizes(normalized);
  const spotColors = extractPmsColors(normalized);

  return {
    customer: extractCustomer(normalized),
    urgency: extractUrgency(normalized),
    requestType: extractRequestType(normalized),
    referenceNumber: firstMatch(normalized, REFERENCE_PATTERN),
    product: firstMatch(normalized, PRODUCT_PATTERN),
    size: sizes[0] ?? null,
    material: firstMatch(normalized, MATERIAL_PATTERN),
    unwind: firstMatch(normalized, UNWIND_PATTERN),
    rollQty: firstMatch(normalized, ROLL_QTY_PATTERN),
    spotColors,
    colorNotes: spotColors.length
      ? `Spot colors identified: ${spotColors.join(", ")}`
      : null,
    barcodeRequirements: normalized.match(BARCODE_PATTERN)?.[0]?.trim() ?? null,
    layoutInstructions: normalized.match(LAYOUT_PATTERN)?.[0]?.trim() ?? null,
    notes: extractNotes(normalized),
    rawExcerpt: normalized.slice(0, 500),
  };
}
