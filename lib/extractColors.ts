export interface ColorAssignment {
  role: string;
  pms: string;
}

export interface ExtractedColors {
  spotColors: string[];
  colorAssignments: ColorAssignment[];
  colorInstructions: string[];
  standardInks: string[];
}

/** Approximate visual descriptions to steer image models toward correct Pantone hues. */
const PMS_VISUAL_HINTS: Record<string, string> = {
  "144C": "warm orange solid ink",
  "7621C": "deep red-maroon solid ink",
  "2695C": "rich purple-violet solid ink",
  "485C": "bright true red (Tyson brand red)",
  "123C": "golden yellow solid ink",
  "186C": "classic red solid ink",
  "032C": "vivid orange-red solid ink",
  "877C": "metallic silver",
  "872C": "metallic gold",
  "Black": "solid process black ink",
  "White": "paper white / knock-out white",
};

const PMS_CODE_PATTERN =
  /(?:PMS|Pantone)\s*(\d{1,4})\s*([CU])?\b/gi;

const COLOR_ASSIGNMENT_PATTERN =
  /([A-Za-z][A-Za-z0-9\s\/\-&']{0,30}?)\s*[:\-–—]\s*((?:PMS|Pantone)\s*\d{1,4}\s*[CU]?)/gi;

const USE_COLOR_FOR_PATTERN =
  /\buse\s+(black|white|tan|orange|red|yellow|blue|green|brown|gold|grey|gray|maroon|purple|burgundy|cream|beige)\b(?:\s+(?:ink|color|PMS|Pantone))?\s+for\s+([^.;\n]+)/gi;

const MATCH_COLOR_FROM_PATTERN =
  /\bmatch\s+(?:the\s+)?(\w+)\s+color\s+from\s+(?:the\s+)?([^.\n;]+)/gi;

const COLOR_KEYWORD_LINE_PATTERN =
  /\b(?:color|colour|colors|colours|ink|spot\s+color|spot\s+colours?)\s*[:\-–—]\s*([^\n]+)/gi;

function normalizePmsCode(raw: string): string {
  const match = raw.match(/(?:PMS|Pantone)\s*(\d{1,4})\s*([CU])?/i);
  if (!match) {
    return raw.trim();
  }

  const number = match[1];
  const suffix = (match[2] ?? "C").toUpperCase();
  return `PMS ${number}${suffix}`;
}

function normalizePmsKey(pms: string): string {
  const match = pms.match(/PMS\s*(\d{1,4})\s*([CU])?/i);
  if (!match) {
    return pms;
  }
  return `${match[1]}${(match[2] ?? "C").toUpperCase()}`;
}

function getVisualHint(pms: string): string | null {
  const key = normalizePmsKey(pms);
  return PMS_VISUAL_HINTS[key] ?? null;
}

function extractPmsCodes(text: string): string[] {
  const colors: string[] = [];
  const regex = new RegExp(PMS_CODE_PATTERN.source, "gi");
  let match: RegExpExecArray | null;

  while ((match = regex.exec(text)) !== null) {
    const fullMatch = match[0];
    colors.push(normalizePmsCode(fullMatch));
  }

  return [...new Set(colors)];
}

function extractColorAssignments(text: string): ColorAssignment[] {
  const assignments: ColorAssignment[] = [];
  const regex = new RegExp(COLOR_ASSIGNMENT_PATTERN.source, "gi");
  let match: RegExpExecArray | null;

  while ((match = regex.exec(text)) !== null) {
    const role = match[1].trim();
    const pms = normalizePmsCode(match[2]);

    if (role.length > 1 && !/^pms$/i.test(role) && !/^pantone$/i.test(role)) {
      assignments.push({ role, pms });
    }
  }

  const seen = new Set<string>();
  return assignments.filter(({ role, pms }) => {
    const key = `${role.toLowerCase()}|${pms}`;
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}

function extractUseColorInstructions(text: string): string[] {
  const instructions: string[] = [];
  const regex = new RegExp(USE_COLOR_FOR_PATTERN.source, "gi");
  let match: RegExpExecArray | null;

  while ((match = regex.exec(text)) !== null) {
    instructions.push(`Use ${match[1]} for ${match[2].trim()}`);
  }

  return instructions;
}

function extractMatchColorInstructions(text: string): string[] {
  const instructions: string[] = [];
  const regex = new RegExp(MATCH_COLOR_FROM_PATTERN.source, "gi");
  let match: RegExpExecArray | null;

  while ((match = regex.exec(text)) !== null) {
    instructions.push(`Match the ${match[1]} color from ${match[2].trim()}`);
  }

  return instructions;
}

function extractColorLines(text: string): string[] {
  const lines: string[] = [];
  const regex = new RegExp(COLOR_KEYWORD_LINE_PATTERN.source, "gi");
  let match: RegExpExecArray | null;

  while ((match = regex.exec(text)) !== null) {
    const line = match[1].trim();
    if (line.length > 3) {
      lines.push(line);
    }
  }

  return [...new Set(lines)].slice(0, 6);
}

function extractStandardInks(text: string): string[] {
  const inks = new Set<string>();
  const lower = text.toLowerCase();

  if (/\bblack\b/.test(lower)) {
    inks.add("Black");
  }
  if (/\bwhite\b/.test(lower)) {
    inks.add("White");
  }

  return [...inks];
}

export function extractColorsFromEmail(emailText: string): ExtractedColors {
  const normalized = emailText.trim();

  const spotColors = extractPmsCodes(normalized);
  const colorAssignments = extractColorAssignments(normalized);
  const colorInstructions = [
    ...extractUseColorInstructions(normalized),
    ...extractMatchColorInstructions(normalized),
    ...extractColorLines(normalized),
  ];
  const standardInks = extractStandardInks(normalized);

  for (const { pms } of colorAssignments) {
    if (!spotColors.includes(pms)) {
      spotColors.push(pms);
    }
  }

  return {
    spotColors: [...new Set(spotColors)],
    colorAssignments,
    colorInstructions: [...new Set(colorInstructions)],
    standardInks,
  };
}

export function buildColorSpecificPromptBlock(colors: ExtractedColors): string {
  const hasPms = colors.spotColors.length > 0;
  const hasInstructions =
    colors.colorInstructions.length > 0 || colors.colorAssignments.length > 0;

  if (!hasPms && !hasInstructions && colors.standardInks.length === 0) {
    return `CRITICAL — SPOT COLOR REQUIREMENTS:
No specific PMS codes were found in the email. Use conservative Tyson/Walmart label palette:
PMS 485 C red, PMS 123 C yellow, solid black, and white only. Do not introduce extra accent colors.`;
  }

  const lines: string[] = [
    "CRITICAL — SPOT COLOR REQUIREMENTS (MUST FOLLOW EXACTLY):",
    "This is a PRINTED LABEL using Pantone spot colors. Do NOT substitute similar hues or invent new brand colors.",
    "Render each listed spot color as a flat, solid ink — not gradients, not approximate CMYK approximations.",
    "",
  ];

  if (hasPms) {
    lines.push("REQUIRED PANTONE SPOT COLORS (use ONLY these):");
    colors.spotColors.forEach((pms, index) => {
      const assignment = colors.colorAssignments.find((a) => a.pms === pms);
      const hint = getVisualHint(pms);
      const roleText = assignment ? ` — assigned to: ${assignment.role}` : "";
      const hintText = hint ? ` | Visual target: ${hint}` : "";
      lines.push(`${index + 1}. ${pms}${roleText}${hintText}`);
    });
    lines.push("");
  }

  if (colors.colorAssignments.length > 0) {
    lines.push("COLOR-TO-ELEMENT MAPPING (apply exactly):");
    colors.colorAssignments.forEach(({ role, pms }) => {
      const hint = getVisualHint(pms);
      lines.push(`- ${role}: ${pms}${hint ? ` (${hint})` : ""}`);
    });
    lines.push("");
  }

  if (colors.standardInks.length > 0) {
    lines.push("STANDARD INKS:");
    colors.standardInks.forEach((ink) => {
      const hint = getVisualHint(ink);
      lines.push(`- ${ink}${hint ? `: ${hint}` : ""}`);
    });
    lines.push("");
  }

  if (colors.colorInstructions.length > 0) {
    lines.push("SPECIAL COLOR INSTRUCTIONS FROM REQUEST:");
    colors.colorInstructions.forEach((instruction) => {
      lines.push(`- ${instruction}`);
    });
    lines.push("");
  }

  lines.push(
    "COLOR ACCURACY RULES:",
    "- Match each PMS code to its true Pantone solid-coating (C) appearance as closely as possible",
    "- Do not shift oranges toward red, reds toward maroon, or purples toward blue unless the PMS code specifies it",
    "- If Black or White are listed, treat them as separate print inks with correct contrast",
    "- Background, logo, text, and accent bands must use the assigned PMS colors only",
    "- No neon, pastel, or saturated hues beyond what the specified Pantone codes represent",
  );

  return lines.join("\n");
}

export function buildColorNotesSummary(colors: ExtractedColors): string | null {
  const parts: string[] = [];

  if (colors.spotColors.length > 0) {
    parts.push(`Spot colors: ${colors.spotColors.join(", ")}`);
  }

  if (colors.colorAssignments.length > 0) {
    const mappings = colors.colorAssignments
      .map(({ role, pms }) => `${role}=${pms}`)
      .join("; ");
    parts.push(`Assignments: ${mappings}`);
  }

  if (colors.colorInstructions.length > 0) {
    parts.push(`Instructions: ${colors.colorInstructions.join(" | ")}`);
  }

  return parts.length > 0 ? parts.join(". ") : null;
}
