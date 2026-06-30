"use client";

import { useCallback, useRef, useState } from "react";
import Image from "next/image";
import { ImagePlus, Mail, X } from "lucide-react";

import { Alert, AlertDescription } from "@/components/ui/alert";
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

interface EmailInputProps {
  emailText: string;
  screenshotPreview: string | null;
  isGenerating: boolean;
  onEmailTextChange: (value: string) => void;
  onScreenshotChange: (file: File | null, preview: string | null) => void;
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

export function EmailInput({
  emailText,
  screenshotPreview,
  isGenerating,
  onEmailTextChange,
  onScreenshotChange,
  onGenerate,
}: EmailInputProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dragActive, setDragActive] = useState(false);

  const handleFile = useCallback(
    (file: File | null) => {
      if (!file) {
        onScreenshotChange(null, null);
        return;
      }

      if (!file.type.startsWith("image/")) {
        return;
      }

      const reader = new FileReader();
      reader.onload = () => {
        onScreenshotChange(file, reader.result as string);
      };
      reader.readAsDataURL(file);
    },
    [onScreenshotChange],
  );

  const handleDrop = useCallback(
    (event: React.DragEvent<HTMLDivElement>) => {
      event.preventDefault();
      setDragActive(false);
      const file = event.dataTransfer.files[0];
      if (file) {
        handleFile(file);
      }
    },
    [handleFile],
  );

  const canGenerate = emailText.trim().length > 20 && !isGenerating;

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="space-y-2 text-center">
        <h2 className="text-2xl font-semibold tracking-tight">New Artwork Request</h2>
        <p className="text-muted-foreground">
          Upload the email screenshot and paste the full email text to generate label concepts.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <ImagePlus className="h-4 w-4" />
            Email Screenshot
          </CardTitle>
          <CardDescription>
            Optional reference image from the request email or attachment preview.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div
            className={`relative flex min-h-[160px] cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed p-6 transition-colors ${
              dragActive
                ? "border-primary bg-primary/5"
                : "border-muted-foreground/25 hover:border-primary/50"
            }`}
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
              accept="image/*"
              className="hidden"
              onChange={(e) => handleFile(e.target.files?.[0] ?? null)}
            />

            {screenshotPreview ? (
              <div className="relative w-full max-w-md">
                <Image
                  src={screenshotPreview}
                  alt="Email screenshot preview"
                  width={400}
                  height={300}
                  className="mx-auto max-h-48 w-auto rounded-md object-contain"
                  unoptimized
                />
                <Button
                  type="button"
                  variant="secondary"
                  size="icon"
                  className="absolute -right-2 -top-2 h-7 w-7"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleFile(null);
                    if (fileInputRef.current) {
                      fileInputRef.current.value = "";
                    }
                  }}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ) : (
              <>
                <ImagePlus className="mb-2 h-8 w-8 text-muted-foreground" />
                <p className="text-sm font-medium">Drop screenshot here or click to upload</p>
                <p className="text-xs text-muted-foreground">PNG, JPG up to 10MB</p>
              </>
            )}
          </div>
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
        {isGenerating ? "Generating Concepts..." : "Generate Concept Images"}
      </Button>
    </div>
  );
}
