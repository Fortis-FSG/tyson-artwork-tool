import type { UploadedReferenceImage } from "@/types";

export const MAX_REFERENCE_IMAGES = 5;
export const MAX_REFERENCE_IMAGE_BYTES = 2 * 1024 * 1024; // 2MB per file
export const XAI_MAX_REFERENCE_IMAGES = 3;

export type { UploadedReferenceImage };

export function createReferenceImageId(): string {
  return `ref-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error(`Failed to read ${file.name}`));
    reader.readAsDataURL(file);
  });
}

export async function filesToReferenceImages(
  files: File[],
  existingCount: number,
): Promise<{ images: UploadedReferenceImage[]; errors: string[] }> {
  const images: UploadedReferenceImage[] = [];
  const errors: string[] = [];
  const availableSlots = MAX_REFERENCE_IMAGES - existingCount;

  if (availableSlots <= 0) {
    return {
      images: [],
      errors: [`Maximum of ${MAX_REFERENCE_IMAGES} reference images allowed.`],
    };
  }

  const filesToProcess = files.slice(0, availableSlots);

  if (files.length > availableSlots) {
    errors.push(
      `Only ${availableSlots} more image(s) can be added (max ${MAX_REFERENCE_IMAGES}).`,
    );
  }

  for (const file of filesToProcess) {
    if (!file.type.startsWith("image/")) {
      errors.push(`"${file.name}" is not an image file.`);
      continue;
    }

    if (file.size > MAX_REFERENCE_IMAGE_BYTES) {
      errors.push(`"${file.name}" exceeds the 2MB size limit.`);
      continue;
    }

    try {
      const dataUrl = await readFileAsDataUrl(file);
      images.push({
        id: createReferenceImageId(),
        name: file.name,
        dataUrl,
      });
    } catch {
      errors.push(`Could not read "${file.name}".`);
    }
  }

  return { images, errors };
}
