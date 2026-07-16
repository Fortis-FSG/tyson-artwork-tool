import { del, get, issueSignedToken, list, presignUrl, put } from "@vercel/blob";
import { randomBytes } from "crypto";

import type {
  CustomerReviewPayload,
  GeneratedConcept,
  SavedRequest,
  SavedRequestSummary,
  UploadedReferenceImage,
} from "@/types";

const BLOB_ACCESS = "private" as const;
const TEAM_URL_TTL_MS = 24 * 60 * 60 * 1000; // 1 day
const CUSTOMER_URL_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days (max practical for review)

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

export function toBlobPathname(urlOrPathname: string): string {
  if (!isHttpUrl(urlOrPathname)) {
    return urlOrPathname.replace(/^\//, "");
  }

  try {
    const url = new URL(urlOrPathname);
    return decodeURIComponent(url.pathname.replace(/^\//, ""));
  } catch {
    return urlOrPathname;
  }
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
    access: BLOB_ACCESS,
    addRandomSuffix: false,
    allowOverwrite: true,
    contentType,
  });
  // Persist pathname so we can re-sign URLs later for private stores.
  return result.pathname;
}

async function readPrivateJson<T>(pathname: string): Promise<T | null> {
  const result = await get(pathname, {
    access: BLOB_ACCESS,
    useCache: false,
  });

  if (!result || result.statusCode !== 200 || !result.stream) {
    return null;
  }

  const text = await new Response(result.stream).text();
  return JSON.parse(text) as T;
}

export async function createSignedGetUrl(
  urlOrPathname: string,
  ttlMs: number = TEAM_URL_TTL_MS,
): Promise<string> {
  if (isDataUrl(urlOrPathname)) {
    return urlOrPathname;
  }

  const pathname = toBlobPathname(urlOrPathname);
  const validUntil = Date.now() + ttlMs;
  const signedToken = await issueSignedToken({
    pathname,
    operations: ["get"],
    validUntil,
  });
  const { presignedUrl } = await presignUrl(signedToken, {
    pathname,
    operation: "get",
    access: BLOB_ACCESS,
    validUntil,
  });
  return presignedUrl;
}

async function signImageField(value: string, ttlMs: number): Promise<string> {
  if (!value || isDataUrl(value)) {
    return value;
  }
  return createSignedGetUrl(value, ttlMs);
}

export async function hydrateSessionForClient(
  session: SavedRequest,
  ttlMs: number = TEAM_URL_TTL_MS,
): Promise<SavedRequest> {
  const concepts = await Promise.all(
    session.concepts.map(async (concept) => ({
      ...concept,
      imageDataUrl: await signImageField(concept.imageDataUrl, ttlMs),
    })),
  );

  const referenceImages = await Promise.all(
    session.referenceImages.map(async (image) => ({
      ...image,
      dataUrl: await signImageField(image.dataUrl, ttlMs),
    })),
  );

  return {
    ...session,
    concepts,
    referenceImages,
  };
}

async function persistConceptImage(
  requestId: string,
  concept: GeneratedConcept,
): Promise<GeneratedConcept> {
  if (!isDataUrl(concept.imageDataUrl)) {
    // Normalize any prior public/private URL down to pathname for storage.
    return {
      ...concept,
      imageDataUrl: toBlobPathname(concept.imageDataUrl),
    };
  }

  const blob = await dataUrlToBlob(concept.imageDataUrl);
  const pathname = await uploadBinary(
    conceptPath(requestId, concept.variant),
    blob,
    "image/png",
  );

  return {
    ...concept,
    imageDataUrl: pathname,
  };
}

async function persistReferenceImage(
  requestId: string,
  image: UploadedReferenceImage,
): Promise<UploadedReferenceImage> {
  if (!isDataUrl(image.dataUrl)) {
    return {
      ...image,
      dataUrl: toBlobPathname(image.dataUrl),
    };
  }

  const blob = await dataUrlToBlob(image.dataUrl);
  const pathname = await uploadBinary(
    referencePath(requestId, image.id),
    blob,
    blob.type || "image/jpeg",
  );

  return {
    ...image,
    dataUrl: pathname,
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

export async function toCustomerReviewPayload(
  session: SavedRequest,
): Promise<CustomerReviewPayload> {
  const concepts = await Promise.all(
    session.concepts.map(async (concept) => ({
      id: concept.id,
      variant: concept.variant,
      imageUrl: await signImageField(concept.imageDataUrl, CUSTOMER_URL_TTL_MS),
    })),
  );

  return {
    product: session.product,
    concepts,
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
    access: BLOB_ACCESS,
    addRandomSuffix: false,
    allowOverwrite: true,
    contentType: "application/json",
  });

  if (persisted.shareToken) {
    await put(
      sharePath(persisted.shareToken),
      JSON.stringify({ sessionId: persisted.id }, null, 2),
      {
        access: BLOB_ACCESS,
        addRandomSuffix: false,
        allowOverwrite: true,
        contentType: "application/json",
      },
    );
  }

  return persisted;
}

export async function readSession(id: string): Promise<SavedRequest | null> {
  return readPrivateJson<SavedRequest>(sessionPath(id));
}

export async function listSessions(): Promise<SavedRequestSummary[]> {
  const { blobs } = await list({ prefix: "sessions/", limit: 1000 });
  const sessionBlobs = blobs.filter((blob) => blob.pathname.endsWith("/session.json"));

  const sessions = await Promise.all(
    sessionBlobs.map(async (blob) => {
      try {
        const session = await readPrivateJson<SavedRequest>(blob.pathname);
        return session ? toSummary(session) : null;
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
  const pointer = await readPrivateJson<{ sessionId?: string }>(sharePath(token));
  if (!pointer?.sessionId) {
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

  const pathnameOrUrl = imageUrl;
  if (isHttpUrl(pathnameOrUrl) && pathnameOrUrl.includes("vercel-blob-delegation")) {
    const response = await fetch(pathnameOrUrl);
    if (!response.ok) {
      throw new Error(`Failed to fetch image: ${response.status}`);
    }
    return Buffer.from(await response.arrayBuffer());
  }

  const pathname = toBlobPathname(pathnameOrUrl);
  const result = await get(pathname, { access: BLOB_ACCESS });
  if (!result || result.statusCode !== 200 || !result.stream) {
    throw new Error("Failed to fetch private blob image");
  }

  return Buffer.from(await new Response(result.stream).arrayBuffer());
}
