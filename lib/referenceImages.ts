export {
  MAX_REFERENCE_IMAGES,
  MAX_IMAGE_UPLOAD_BYTES,
  MAX_ZIP_UPLOAD_BYTES,
  XAI_MAX_REFERENCE_IMAGES,
  processUploadFiles,
} from "@/lib/processUploads";

export type { ProcessUploadsResult } from "@/lib/processUploads";

export { MAX_API_IMAGE_BYTES, estimateDataUrlBytes } from "@/lib/compressImage";
