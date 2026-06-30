export type AppStep = "input" | "generating" | "review" | "output";

export type Urgency = "standard" | "rush" | "urgent";

export interface LabelSpecifications {
  size: string | null;
  material: string | null;
  unwind: string | null;
  roll_qty: string | null;
}

export interface ColorSpecifications {
  spot_colors: string[];
  special_instructions: string | null;
}

export interface ArtworkRequest {
  request_id: string;
  received_at: string;
  customer: string;
  urgency: Urgency;
  request_type: string;
  reference_number: string | null;
  product: string | null;
  label_specifications: LabelSpecifications;
  colors: ColorSpecifications;
  barcode_requirements: string | null;
  layout_instructions: string | null;
  parsed_notes: string[];
}

export interface GeneratedConcept {
  id: string;
  imageDataUrl: string;
  prompt: string;
  variant: number;
}

export interface UploadedReferenceImage {
  id: string;
  name: string;
  dataUrl: string;
}

export interface GenerateImagesResponse {
  concepts: GeneratedConcept[];
}

export interface GenerateOutputResponse {
  artworkRequest: ArtworkRequest;
  designBrief: string;
}

export interface ColorAssignment {
  role: string;
  pms: string;
}

export interface ParsedEmailContext {
  customer: string | null;
  urgency: Urgency;
  requestType: string | null;
  referenceNumber: string | null;
  product: string | null;
  size: string | null;
  material: string | null;
  unwind: string | null;
  rollQty: string | null;
  spotColors: string[];
  colorAssignments: ColorAssignment[];
  colorInstructions: string[];
  standardInks: string[];
  colorNotes: string | null;
  barcodeRequirements: string | null;
  layoutInstructions: string | null;
  notes: string[];
  rawExcerpt: string;
}
