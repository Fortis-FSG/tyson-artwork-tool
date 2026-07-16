export type AppStep = "input" | "generating" | "review" | "output";

export type Urgency = "standard" | "rush" | "urgent";

export type RequestStatus =
  | "draft"
  | "awaiting_customer"
  | "customer_approved"
  | "handed_off";

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
  /** Data URL or remote Blob URL used for display/download */
  imageDataUrl: string;
  prompt: string;
  variant: number;
}

export interface SavedRequest {
  id: string;
  status: RequestStatus;
  step: AppStep;
  emailText: string;
  attachmentContext: string;
  product: string | null;
  customer: string | null;
  referenceNumber: string | null;
  urgency: Urgency;
  concepts: GeneratedConcept[];
  referenceImages: UploadedReferenceImage[];
  selectedConceptId: string | null;
  customerApprovedConceptId: string | null;
  customerComment: string | null;
  artworkRequest: ArtworkRequest | null;
  designBrief: string;
  shareToken: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface SavedRequestSummary {
  id: string;
  status: RequestStatus;
  step: AppStep;
  product: string | null;
  customer: string | null;
  referenceNumber: string | null;
  urgency: Urgency;
  conceptCount: number;
  selectedConceptId: string | null;
  customerApprovedConceptId: string | null;
  shareToken: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CustomerReviewPayload {
  product: string | null;
  concepts: Array<{
    id: string;
    variant: number;
    imageUrl: string;
  }>;
  approvedConceptId: string | null;
  alreadyApproved: boolean;
}

export interface UploadedReferenceImage {
  id: string;
  name: string;
  dataUrl: string;
  source?: "upload" | "zip";
  sourceArchive?: string;
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
