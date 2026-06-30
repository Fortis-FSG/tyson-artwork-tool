"use client";

import { useCallback, useState } from "react";

import { EmailInput } from "@/components/EmailInput";
import { ImageGrid } from "@/components/ImageGrid";
import { OutputPanel } from "@/components/OutputPanel";
import { Badge } from "@/components/ui/badge";
import { generateOutput } from "@/lib/generateOutput";
import type {
  AppStep,
  ArtworkRequest,
  GeneratedConcept,
  GenerateImagesResponse,
} from "@/types";

const STEPS: { key: AppStep; label: string }[] = [
  { key: "input", label: "Input" },
  { key: "review", label: "Review" },
  { key: "output", label: "Output" },
];

function getStepIndex(step: AppStep): number {
  if (step === "input" || step === "generating") {
    return 0;
  }
  if (step === "review") {
    return 1;
  }
  return 2;
}

export default function HomePage() {
  const [step, setStep] = useState<AppStep>("input");
  const [emailText, setEmailText] = useState("");
  const [screenshotPreview, setScreenshotPreview] = useState<string | null>(null);
  const [concepts, setConcepts] = useState<GeneratedConcept[]>([]);
  const [selectedConcept, setSelectedConcept] = useState<GeneratedConcept | null>(null);
  const [artworkRequest, setArtworkRequest] = useState<ArtworkRequest | null>(null);
  const [designBrief, setDesignBrief] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isRegenerating, setIsRegenerating] = useState(false);

  const generateImages = useCallback(async () => {
    setError(null);
    setIsGenerating(true);
    setStep("generating");

    try {
      const response = await fetch("/api/generate-images", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          emailText,
          hasScreenshot: Boolean(screenshotPreview),
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error ?? "Failed to generate images");
      }

      const result = data as GenerateImagesResponse;
      setConcepts(result.concepts);
      setSelectedConcept(null);
      setStep("review");
    } catch (err) {
      setError(err instanceof Error ? err.message : "An unexpected error occurred");
      setStep("input");
    } finally {
      setIsGenerating(false);
      setIsRegenerating(false);
    }
  }, [emailText, screenshotPreview]);

  const handleRegenerate = useCallback(async () => {
    setIsRegenerating(true);
    await generateImages();
  }, [generateImages]);

  const handleSelectConcept = useCallback(
    async (concept: GeneratedConcept) => {
      setSelectedConcept(concept);
      setError(null);

      try {
        const response = await fetch("/api/generate-output", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            emailText,
            selectedConcept: concept,
          }),
        });

        if (!response.ok) {
          const data = await response.json();
          throw new Error(data.error ?? "Failed to generate output");
        }

        const data = await response.json();
        setArtworkRequest(data.artworkRequest);
        setDesignBrief(data.designBrief);
      } catch {
        const fallback = generateOutput(emailText, concept);
        setArtworkRequest(fallback.artworkRequest);
        setDesignBrief(fallback.designBrief);
      }

      setStep("output");
    },
    [emailText],
  );

  const handleStartOver = useCallback(() => {
    setStep("input");
    setEmailText("");
    setScreenshotPreview(null);
    setConcepts([]);
    setSelectedConcept(null);
    setArtworkRequest(null);
    setDesignBrief("");
    setError(null);
  }, []);

  const currentStepIndex = getStepIndex(step);

  return (
    <div className="space-y-8">
      <div className="flex justify-center">
        <div className="flex items-center gap-2">
          {STEPS.map((s, index) => (
            <div key={s.key} className="flex items-center gap-2">
              <Badge variant={index <= currentStepIndex ? "default" : "secondary"}>
                {index + 1}. {s.label}
              </Badge>
              {index < STEPS.length - 1 && (
                <span className="text-muted-foreground">→</span>
              )}
            </div>
          ))}
        </div>
      </div>

      {error && step === "input" && (
        <div className="mx-auto max-w-3xl rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive">
          {error}
        </div>
      )}

      {step === "input" && (
        <EmailInput
          emailText={emailText}
          screenshotPreview={screenshotPreview}
          isGenerating={isGenerating}
          onEmailTextChange={setEmailText}
          onScreenshotChange={(_, preview) => setScreenshotPreview(preview)}
          onGenerate={generateImages}
        />
      )}

      {(step === "generating" || step === "review") && (
        <ImageGrid
          concepts={concepts}
          isGenerating={step === "generating" && !isRegenerating}
          isRegenerating={isRegenerating}
          selectedConceptId={selectedConcept?.id ?? null}
          error={step === "review" ? error : null}
          onSelect={handleSelectConcept}
          onRegenerate={handleRegenerate}
          onBack={() => {
            setStep("input");
            setError(null);
          }}
        />
      )}

      {step === "output" && artworkRequest && selectedConcept && (
        <OutputPanel
          artworkRequest={artworkRequest}
          designBrief={designBrief}
          selectedConcept={selectedConcept}
          onStartOver={handleStartOver}
          onBackToReview={() => setStep("review")}
        />
      )}
    </div>
  );
}
