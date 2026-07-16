import { del, list, put } from "@vercel/blob";
import { randomBytes } from "crypto";

import type {
  CustomerReviewPayload,
  GeneratedConcept,
  SavedRequest,
  SavedRequestSummary,
  UploadedReferenceImage,
} from "@/types";

function sessionPath(id: string): string {
  return `sessions/${id}/session.json`;
}

function conceptPath(id: string, variant: number): string {
  return `sessions/${id}/concept-${variant}.png`;
}

function referencePath(id: string, imageId: string): string {
  return `sessions/${id}/references/${imageId}.jpg`;
}

function sharePath(token: string): string {
  return `shares/${token}.json`;
}

function isDataUrl(value: string): boolean {
  return value.startsWith("data:");
}

function isHttpUrl(value: string): boolean {
  return value.startsWith("http://") || value.startsWith("https://");
}

async function dataUrlToBlob(dataUrl: string): Promise<Blob> {
  const response = await fetch(dataUrl);
  return response.blob();
}

async function uploadBinary(
  pathname: string,
  body: Blob | ArrayBuffer | Buffer,
  contentType: string,
): Promise<string> {
  const result = await put(pathname, body, {
    access: "public",
    addRandomSuffix: false,
    allowOverwrite: true,
    contentType,
  });
  return result.url;
}

async function persistConceptImage(
  requestId: string,
  concept: GeneratedConcept,
): Promise<GeneratedConcept> {
  if (!isDataUrl(concept.imageDataUrl)) {
    return concept;
  }

  const blob = await dataUrlToBlob(concept.imageDataUrl);
  const imageUrl = await uploadBinary(
    conceptPath(requestId, concept.variant),
    blob,
    "image/png",
  );

  return {
    ...concept,
    imageDataUrl: imageUrl,
  };
}

async function persistReferenceImage(
  requestId: string,
  image: UploadedReferenceImage,
): Promise<UploadedReferenceImage> {
  if (!isDataUrl(image.dataUrl)) {
    return image;
  }

  const blob = await dataUrlToBlob(image.dataUrl);
  const dataUrl = await uploadBinary(
    referencePath(requestId, image.id),
    blob,
    blob.type || "image/jpeg",
  );

  return {
    ...image,
    dataUrl,
  };
}

export function createShareToken(): string {
  return randomBytes(24).toString("base64url");
}

export function toSummary(session: SavedRequest): SavedRequestSummary {
  return {
    id: session.id,
    status: session.status,
    step: session.step,
    product: session.product,
    customer: session.customer,
    referenceNumber: session.referenceNumber,
    urgency: session.urgency,
    conceptCount: session.concepts.length,
    selectedConceptId: session.selectedConceptId,
    customerApprovedConceptId: session.customerApprovedConceptId,
    shareToken: session.shareToken,
    createdAt: session.createdAt,
    updatedAt: session.updatedAt,
  };
}

export function toCustomerReviewPayload(session: SavedRequest): CustomerReviewPayload {
  return {
    product: session.product,
    concepts: session.concepts.map((concept) => ({
      id: concept.id,
      variant: concept.variant,
      imageUrl: concept.imageDataUrl,
    })),
    approvedConceptId: session.customerApprovedConceptId,
    alreadyApproved: session.status === "customer_approved",
  };
}

export async function writeSession(session: SavedRequest): Promise<SavedRequest> {
  const now = new Date().toISOString();
  const concepts = await Promise.all(
    session.concepts.map((concept) => persistConceptImage(session.id, concept)),
  );
  const referenceImages = await Promise.all(
    session.referenceImages.map((image) => persistReferenceImage(session.id, image)),
  );

  const persisted: SavedRequest = {
    ...session,
    concepts,
    referenceImages,
    updatedAt: now,
    createdAt: session.createdAt || now,
  };

  await put(sessionPath(session.id), JSON.stringify(persisted, null, 2), {
    access: "public",
    addRandomSuffix: false,
    allowOverwrite: true,
    contentType: "application/json",
  });

  if (persisted.shareToken) {
    await put(
      sharePath(persisted.shareToken),
      JSON.stringify({ sessionId: persisted.id }, null, 2),
      {
        access: "public",
        addRandomSuffix: false,
        allowOverwrite: true,
        contentType: "application/json",
      },
    );
  }

  return persisted;
}

export async function readSession(id: string): Promise<SavedRequest | null> {
  const { blobs } = await list({ prefix: sessionPath(id), limit: 1 });
  const match = blobs.find((blob) => blob.pathname === sessionPath(id));
  if (!match) {
    return null;
  }

  const response = await fetch(match.url, { cache: "no-store" });
  if (!response.ok) {
    return null;
  }

  return (await response.json()) as SavedRequest;
}

export async function listSessions(): Promise<SavedRequestSummary[]> {
  const { blobs } = await list({ prefix: "sessions/", limit: 1000 });
  const sessionBlobs = blobs.filter((blob) => blob.pathname.endsWith("/session.json"));

  const sessions = await Promise.all(
    sessionBlobs.map(async (blob) => {
      try {
        const response = await fetch(blob.url, { cache: "no-store" });
        if (!response.ok) {
          return null;
        }
        const session = (await response.json()) as SavedRequest;
        return toSummary(session);
      } catch {
        return null;
      }
    }),
  );

  return sessions
    .filter((session): session is SavedRequestSummary => Boolean(session))
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export async function deleteSession(id: string): Promise<void> {
  const existing = await readSession(id);
  const { blobs } = await list({ prefix: `sessions/${id}/`, limit: 1000 });
  if (blobs.length > 0) {
    await del(blobs.map((blob) => blob.url));
  }

  if (existing?.shareToken) {
    const { blobs: shareBlobs } = await list({
      prefix: sharePath(existing.shareToken),
      limit: 1,
    });
    if (shareBlobs.length > 0) {
      await del(shareBlobs.map((blob) => blob.url));
    }
  }
}

export async function findSessionByShareToken(
  token: string,
): Promise<SavedRequest | null> {
  const { blobs } = await list({ prefix: sharePath(token), limit: 1 });
  const match = blobs.find((blob) => blob.pathname === sharePath(token));
  if (!match) {
    return null;
  }

  const response = await fetch(match.url, { cache: "no-store" });
  if (!response.ok) {
    return null;
  }

  const pointer = (await response.json()) as { sessionId?: string };
  if (!pointer.sessionId) {
    return null;
  }

  return readSession(pointer.sessionId);
}

export async function ensureShareToken(session: SavedRequest): Promise<SavedRequest> {
  if (session.shareToken) {
    if (session.status === "draft") {
      return writeSession({
        ...session,
        status: "awaiting_customer",
      });
    }
    return session;
  }

  return writeSession({
    ...session,
    shareToken: createShareToken(),
    status: session.status === "draft" ? "awaiting_customer" : session.status,
  });
}

export async function fetchImageBytes(imageUrl: string): Promise<Buffer> {
  if (isDataUrl(imageUrl)) {
    const base64 = imageUrl.split(",")[1] ?? "";
    return Buffer.from(base64, "base64");
  }

  if (!isHttpUrl(imageUrl)) {
    throw new Error("Unsupported image URL");
  }

  const response = await fetch(imageUrl);
  if (!response.ok) {
    throw new Error(`Failed to fetch image: ${response.status}`);
  }

  return Buffer.from(await response.arrayBuffer());
}
