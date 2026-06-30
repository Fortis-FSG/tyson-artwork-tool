import JSZip from "jszip";

import { compressImageForApi } from "@/lib/compressImage";
import type { UploadedReferenceImage } from "@/types";

export const MAX_REFERENCE_IMAGES = 10;
export const MAX_IMAGE_UPLOAD_BYTES = 10 * 1024 * 1024; // 10MB per image
export const MAX_ZIP_UPLOAD_BYTES = 50 * 1024 * 1024; // 50MB per zip archive
export const XAI_MAX_REFERENCE_IMAGES = 3;

const IMAGE_EXTENSIONS = new Set([
  ".png",
  ".jpg",
  ".jpeg",
  ".webp",
  ".gif",
  ".bmp",
  ".tif",
  ".tiff",
]);

const TEXT_EXTENSIONS = new Set([".txt", ".md", ".csv", ".json", ".xml", ".html", ".htm"]);

const SKIP_PATH_PATTERNS = [/^__MACOSX\//, /\/\.DS_Store$/, /^\._/];

const MAX_TEXT_FILE_BYTES = 32 * 1024;
const MAX_TEXT_FILES_FROM_ZIP = 8;
const MAX_ATTACHMENT_CONTEXT_CHARS = 12_000;

export interface ProcessUploadsResult {
  images: UploadedReferenceImage[];
  attachmentContext: string;
  errors: string[];
  notices: string[];
}

function createReferenceImageId(): string {
  return `ref-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function readFileAsDataUrl(file: File | Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error("Failed to read file"));
    reader.readAsDataURL(file);
  });
}

function getExtension(path: string): string {
  const name = path.split("/").pop() ?? path;
  const dot = name.lastIndexOf(".");
  return dot >= 0 ? name.slice(dot).toLowerCase() : "";
}

function shouldSkipPath(path: string): boolean {
  return SKIP_PATH_PATTERNS.some((pattern) => pattern.test(path));
}

function isZipFile(file: File): boolean {
  return (
    file.name.toLowerCase().endsWith(".zip") ||
    file.type === "application/zip" ||
    file.type === "application/x-zip-compressed"
  );
}

function isImageFile(file: File): boolean {
  return file.type.startsWith("image/") || IMAGE_EXTENSIONS.has(getExtension(file.name));
}

function formatMb(bytes: number): string {
  return `${Math.round(bytes / (1024 * 1024))}MB`;
}

async function blobToReferenceImage(
  blob: Blob,
  name: string,
  source: UploadedReferenceImage["source"],
  sourceArchive?: string,
): Promise<UploadedReferenceImage> {
  const dataUrl = await readFileAsDataUrl(blob);
  const compressed = await compressImageForApi(dataUrl);

  return {
    id: createReferenceImageId(),
    name,
    dataUrl: compressed,
    source,
    sourceArchive,
  };
}

async function processImageFile(file: File): Promise<UploadedReferenceImage> {
  if (file.size > MAX_IMAGE_UPLOAD_BYTES) {
    throw new Error(
      `"${file.name}" exceeds the ${formatMb(MAX_IMAGE_UPLOAD_BYTES)} image size limit.`,
    );
  }

  const dataUrl = await readFileAsDataUrl(file);
  const compressed = await compressImageForApi(dataUrl);

  return {
    id: createReferenceImageId(),
    name: file.name,
    dataUrl: compressed,
    source: "upload",
  };
}

async function processZipFile(
  file: File,
  existingCount: number,
  availableSlots: number,
): Promise<Pick<ProcessUploadsResult, "images" | "attachmentContext" | "errors" | "notices">> {
  const images: UploadedReferenceImage[] = [];
  const errors: string[] = [];
  const notices: string[] = [];
  const textSnippets: string[] = [];

  if (file.size > MAX_ZIP_UPLOAD_BYTES) {
    return {
      images: [],
      attachmentContext: "",
      errors: [
        `"${file.name}" exceeds the ${formatMb(MAX_ZIP_UPLOAD_BYTES)} zip size limit.`,
      ],
      notices: [],
    };
  }

  let zip: JSZip;
  try {
    zip = await JSZip.loadAsync(file);
  } catch {
    return {
      images: [],
      attachmentContext: "",
      errors: [`"${file.name}" is not a valid zip archive.`],
      notices: [],
    };
  }

  const entries = Object.entries(zip.files)
    .filter(([path, entry]) => !entry.dir && !shouldSkipPath(path))
    .sort(([a], [b]) => a.localeCompare(b));

  let textFilesRead = 0;

  for (const [path, entry] of entries) {
    const ext = getExtension(path);
    const fileName = path.split("/").pop() ?? path;

    if (IMAGE_EXTENSIONS.has(ext) && images.length + existingCount < MAX_REFERENCE_IMAGES) {
      if (images.length >= availableSlots) {
        continue;
      }

      try {
        const blob = await entry.async("blob");
        if (blob.size > MAX_IMAGE_UPLOAD_BYTES) {
          errors.push(`Skipped "${path}" inside zip (exceeds ${formatMb(MAX_IMAGE_UPLOAD_BYTES)}).`);
          continue;
        }

        const image = await blobToReferenceImage(
          blob,
          `${fileName} (from ${file.name})`,
          "zip",
          file.name,
        );
        images.push(image);
      } catch {
        errors.push(`Could not extract image "${path}" from "${file.name}".`);
      }
      continue;
    }

    if (
      TEXT_EXTENSIONS.has(ext) &&
      textFilesRead < MAX_TEXT_FILES_FROM_ZIP &&
      textSnippets.join("\n").length < MAX_ATTACHMENT_CONTEXT_CHARS
    ) {
      try {
        const content = await entry.async("string");
        if (content.length > MAX_TEXT_FILE_BYTES) {
          errors.push(`Skipped "${path}" (text file too large).`);
          continue;
        }

        textSnippets.push(`--- ${path} ---\n${content.trim()}`);
        textFilesRead += 1;
      } catch {
        errors.push(`Could not read text file "${path}" from "${file.name}".`);
      }
    }
  }

  const attachmentContext = textSnippets.join("\n\n").slice(0, MAX_ATTACHMENT_CONTEXT_CHARS);

  if (images.length > 0) {
    notices.push(
      `Extracted ${images.length} image(s) from "${file.name}".`,
    );
  }

  if (attachmentContext) {
    notices.push(
      `Extracted text context from ${textFilesRead} file(s) in "${file.name}".`,
    );
  }

  if (images.length === 0 && !attachmentContext) {
    errors.push(
      `"${file.name}" contained no supported images or text files. Supported: PNG, JPG, WebP, GIF, TXT, MD, CSV, JSON.`,
    );
  }

  return { images, attachmentContext, errors, notices };
}

export async function processUploadFiles(
  files: File[],
  existingImages: UploadedReferenceImage[],
  existingContext: string,
): Promise<ProcessUploadsResult> {
  const images: UploadedReferenceImage[] = [];
  const errors: string[] = [];
  const notices: string[] = [];
  const contextParts: string[] = existingContext ? [existingContext] : [];

  let runningCount = existingImages.length;

  for (const file of files) {
    const availableSlots = MAX_REFERENCE_IMAGES - runningCount;

    if (isZipFile(file)) {
      const zipResult = await processZipFile(file, runningCount, availableSlots);
      images.push(...zipResult.images);
      runningCount += zipResult.images.length;
      errors.push(...zipResult.errors);
      notices.push(...zipResult.notices);

      if (zipResult.attachmentContext) {
        contextParts.push(`[From ${file.name}]\n${zipResult.attachmentContext}`);
      }
      continue;
    }

    if (isImageFile(file)) {
      if (availableSlots <= 0) {
        errors.push(`Maximum of ${MAX_REFERENCE_IMAGES} reference images reached.`);
        continue;
      }

      try {
        const image = await processImageFile(file);
        images.push(image);
        runningCount += 1;
      } catch (err) {
        errors.push(err instanceof Error ? err.message : `Could not process "${file.name}".`);
      }
      continue;
    }

    errors.push(
      `"${file.name}" is not supported. Upload images (PNG, JPG, WebP) or a .zip archive.`,
    );
  }

  const attachmentContext = contextParts.join("\n\n").slice(0, MAX_ATTACHMENT_CONTEXT_CHARS);

  return {
    images,
    attachmentContext,
    errors: [...new Set(errors)],
    notices: [...new Set(notices)],
  };
}
