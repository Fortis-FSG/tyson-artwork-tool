"use client";

import { useCallback, useRef, useState } from "react";
import Image from "next/image";
import { Archive, ImagePlus, Mail, X } from "lucide-react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  MAX_IMAGE_UPLOAD_BYTES,
  MAX_REFERENCE_IMAGES,
  MAX_ZIP_UPLOAD_BYTES,
  processUploadFiles,
  XAI_MAX_REFERENCE_IMAGES,
} from "@/lib/referenceImages";
import type { UploadedReferenceImage } from "@/types";

interface EmailInputProps {
  emailText: string;
  referenceImages: UploadedReferenceImage[];
  attachmentContext: string;
  isGenerating: boolean;
  onEmailTextChange: (value: string) => void;
  onReferenceImagesChange: (images: UploadedReferenceImage[]) => void;
  onAttachmentContextChange: (context: string) => void;
  onGenerate: () => void;
}

const SAMPLE_EMAIL = `Subject: WM Rapid Mock Request - Tyson Grilled Chicken Strips

Hi Team,

Please create a rapid mock for the following Tyson Walmart label:

Reference #: WM-2024-8847
Product: Tyson Grilled Chicken Strips 16oz
Label Size: 3.7" x 3.01"
Material: White BOPP
Unwind: #1
Roll Qty: 12,000

Colors:
- PMS 485 C (Tyson Red)
- PMS 123 C (Yellow)
- Black
- White

Barcode: 2D matrix required, bottom right placement with quiet zone
Layout: Mimic attached reference AI file. Logo top center, product name bold below.
Include "Great Value" branding per WM spec.

Please rush - needed for buyer review by EOD.

Thanks,
Sarah Mitchell
Tyson Foods Packaging`;

function formatMb(bytes: number): string {
  return `${Math.round(bytes / (1024 * 1024))}MB`;
}

export function EmailInput({
  emailText,
  referenceImages,
  attachmentContext,
  isGenerating,
  onEmailTextChange,
  onReferenceImagesChange,
  onAttachmentContextChange,
  onGenerate,
}: EmailInputProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dragActive, setDragActive] = useState(false);
  const [uploadErrors, setUploadErrors] = useState<string[]>([]);
  const [uploadNotices, setUploadNotices] = useState<string[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);

  const addFiles = useCallback(
    async (files: FileList | File[]) => {
      const fileArray = Array.from(files);
      if (fileArray.length === 0) {
        return;
      }

      setIsProcessing(true);
      setUploadErrors([]);
      setUploadNotices([]);

      try {
        const result = await processUploadFiles(
          fileArray,
          referenceImages,
          attachmentContext,
        );

        if (result.images.length > 0) {
          onReferenceImagesChange([...referenceImages, ...result.images]);
        }

        if (result.attachmentContext !== attachmentContext) {
          onAttachmentContextChange(result.attachmentContext);
        }

        setUploadErrors(result.errors);
        setUploadNotices(result.notices);
      } finally {
        setIsProcessing(false);
      }
    },
    [
      attachmentContext,
      onAttachmentContextChange,
      onReferenceImagesChange,
      referenceImages,
    ],
  );

  const removeImage = useCallback(
    (id: string) => {
      onReferenceImagesChange(referenceImages.filter((img) => img.id !== id));
      setUploadErrors([]);
    },
    [onReferenceImagesChange, referenceImages],
  );

  const clearAllAttachments = useCallback(() => {
    onReferenceImagesChange([]);
    onAttachmentContextChange("");
    setUploadErrors([]);
    setUploadNotices([]);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }, [onAttachmentContextChange, onReferenceImagesChange]);

  const handleDrop = useCallback(
    (event: React.DragEvent<HTMLDivElement>) => {
      event.preventDefault();
      setDragActive(false);
      void addFiles(event.dataTransfer.files);
    },
    [addFiles],
  );

  const canAddMore = referenceImages.length < MAX_REFERENCE_IMAGES;
  const canGenerate = emailText.trim().length > 20 && !isGenerating && !isProcessing;
  const hasAttachments = referenceImages.length > 0 || attachmentContext.length > 0;

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="space-y-2 text-center">
        <h2 className="text-2xl font-semibold tracking-tight">New Artwork Request</h2>
        <p className="text-muted-foreground">
          Upload reference files and paste the full email text to generate label concepts.
        </p>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-start justify-between gap-4">
            <div>
              <CardTitle className="flex items-center gap-2 text-base">
                <ImagePlus className="h-4 w-4" />
                Reference Files
              </CardTitle>
              <CardDescription>
                Images or .zip archives (email screenshots, artwork, spec sheets). Up to{" "}
                {MAX_REFERENCE_IMAGES} images ({XAI_MAX_REFERENCE_IMAGES} sent to AI). Images
                up to {formatMb(MAX_IMAGE_UPLOAD_BYTES)}, zip up to{" "}
                {formatMb(MAX_ZIP_UPLOAD_BYTES)}.
              </CardDescription>
            </div>
            {hasAttachments && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="shrink-0 text-xs"
                onClick={clearAllAttachments}
              >
                Clear all
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {referenceImages.length > 0 && (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {referenceImages.map((image, index) => (
                <div
                  key={image.id}
                  className="relative overflow-hidden rounded-lg border bg-muted"
                >
                  <div className="relative aspect-[4/3]">
                    <Image
                      src={image.dataUrl}
                      alt={image.name}
                      fill
                      className="object-contain p-1"
                      unoptimized
                    />
                  </div>
                  <div className="border-t bg-background px-2 py-1.5">
                    <p className="truncate text-xs font-medium" title={image.name}>
                      {image.name}
                    </p>
                    <div className="mt-0.5 flex flex-wrap items-center gap-1">
                      {image.source === "zip" && (
                        <Badge variant="secondary" className="h-4 px-1 text-[9px]">
                          <Archive className="mr-0.5 h-2.5 w-2.5" />
                          ZIP
                        </Badge>
                      )}
                      <p className="text-[10px] text-muted-foreground">
                        {index < XAI_MAX_REFERENCE_IMAGES
                          ? `AI ref IMAGE_${index}`
                          : "Context only"}
                      </p>
                    </div>
                  </div>
                  <Button
                    type="button"
                    variant="secondary"
                    size="icon"
                    className="absolute right-1 top-1 h-6 w-6"
                    onClick={() => removeImage(image.id)}
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </div>
              ))}
            </div>
          )}

          {attachmentContext && (
            <div className="rounded-lg border bg-muted/40 p-3">
              <p className="mb-1 text-xs font-medium">Extracted zip context</p>
              <p className="line-clamp-3 text-xs text-muted-foreground">
                {attachmentContext.slice(0, 300)}
                {attachmentContext.length > 300 ? "…" : ""}
              </p>
            </div>
          )}

          {canAddMore && (
            <div
              className={`relative flex min-h-[120px] cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed p-6 transition-colors ${
                dragActive
                  ? "border-primary bg-primary/5"
                  : "border-muted-foreground/25 hover:border-primary/50"
              } ${isProcessing ? "pointer-events-none opacity-60" : ""}`}
              onDragOver={(e) => {
                e.preventDefault();
                setDragActive(true);
              }}
              onDragLeave={() => setDragActive(false)}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  fileInputRef.current?.click();
                }
              }}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*,.zip,application/zip,application/x-zip-compressed"
                multiple
                className="hidden"
                onChange={(e) => {
                  if (e.target.files) {
                    void addFiles(e.target.files);
                  }
                  e.target.value = "";
                }}
              />

              <ImagePlus className="mb-2 h-7 w-7 text-muted-foreground" />
              <p className="text-sm font-medium">
                {isProcessing
                  ? "Processing files…"
                  : referenceImages.length === 0
                    ? "Drop files here or click to upload"
                    : "Add more reference files"}
              </p>
              <p className="text-center text-xs text-muted-foreground">
                PNG, JPG, WebP ({formatMb(MAX_IMAGE_UPLOAD_BYTES)} max) · .zip (
                {formatMb(MAX_ZIP_UPLOAD_BYTES)} max)
              </p>
            </div>
          )}

          {!canAddMore && (
            <p className="text-center text-xs text-muted-foreground">
              Maximum of {MAX_REFERENCE_IMAGES} reference images reached.
            </p>
          )}

          {uploadNotices.length > 0 && (
            <Alert>
              <AlertDescription>
                <ul className="list-inside list-disc space-y-1">
                  {uploadNotices.map((notice) => (
                    <li key={notice}>{notice}</li>
                  ))}
                </ul>
              </AlertDescription>
            </Alert>
          )}

          {uploadErrors.length > 0 && (
            <Alert variant="destructive">
              <AlertDescription>
                <ul className="list-inside list-disc space-y-1">
                  {uploadErrors.map((error) => (
                    <li key={error}>{error}</li>
                  ))}
                </ul>
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Mail className="h-4 w-4" />
            Email Text
          </CardTitle>
          <CardDescription>
            Paste the complete email including subject, specs, colors, and special instructions.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="email-text">Full email content</Label>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-auto px-2 py-1 text-xs"
                onClick={() => onEmailTextChange(SAMPLE_EMAIL)}
              >
                Load sample
              </Button>
            </div>
            <Textarea
              id="email-text"
              placeholder="Paste the full Tyson artwork request email here..."
              value={emailText}
              onChange={(e) => onEmailTextChange(e.target.value)}
              className="min-h-[280px] font-mono text-sm"
            />
          </div>

          {emailText.trim().length > 0 && emailText.trim().length <= 20 && (
            <Alert variant="destructive">
              <AlertDescription>
                Please paste the full email text (at least a few lines of content).
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      <Button
        size="lg"
        className="h-14 w-full text-base"
        disabled={!canGenerate}
        onClick={onGenerate}
      >
        {isGenerating
          ? "Generating Concepts..."
          : isProcessing
            ? "Processing Uploads..."
            : "Generate Concept Images"}
      </Button>
    </div>
  );
}
