/** Target max size per image sent to the API (keeps total payload under Vercel limits). */
export const MAX_API_IMAGE_BYTES = 1.5 * 1024 * 1024;

export function estimateDataUrlBytes(dataUrl: string): number {
  const base64 = dataUrl.split(",")[1] ?? "";
  return Math.ceil((base64.length * 3) / 4);
}

export async function compressImageForApi(
  dataUrl: string,
  maxBytes: number = MAX_API_IMAGE_BYTES,
): Promise<string> {
  if (estimateDataUrlBytes(dataUrl) <= maxBytes) {
    return dataUrl;
  }

  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d");

      if (!ctx) {
        reject(new Error("Could not compress image"));
        return;
      }

      let { width, height } = img;
      const maxDimension = 2048;

      if (width > maxDimension || height > maxDimension) {
        const scale = maxDimension / Math.max(width, height);
        width = Math.round(width * scale);
        height = Math.round(height * scale);
      }

      canvas.width = width;
      canvas.height = height;
      ctx.drawImage(img, 0, 0, width, height);

      let quality = 0.92;
      let result = canvas.toDataURL("image/jpeg", quality);

      while (estimateDataUrlBytes(result) > maxBytes && quality > 0.4) {
        quality -= 0.08;
        result = canvas.toDataURL("image/jpeg", quality);
      }

      if (estimateDataUrlBytes(result) > maxBytes) {
        const shrink = Math.sqrt(maxBytes / estimateDataUrlBytes(result)) * 0.9;
        canvas.width = Math.round(width * shrink);
        canvas.height = Math.round(height * shrink);
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        result = canvas.toDataURL("image/jpeg", 0.85);
      }

      resolve(result);
    };
    img.onerror = () => reject(new Error("Could not load image for compression"));
    img.src = dataUrl;
  });
}
