"use client";

import Image from "next/image";
import { Check, Loader2, RefreshCw } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { GeneratedConcept } from "@/types";

interface ImageGridProps {
  concepts: GeneratedConcept[];
  isGenerating: boolean;
  isRegenerating: boolean;
  selectedConceptId: string | null;
  error: string | null;
  onSelect: (concept: GeneratedConcept) => void;
  onRegenerate: () => void;
  onBack: () => void;
}

export function ImageGrid({
  concepts,
  isGenerating,
  isRegenerating,
  selectedConceptId,
  error,
  onSelect,
  onRegenerate,
  onBack,
}: ImageGridProps) {
  const loading = isGenerating || isRegenerating;

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <h2 className="text-2xl font-semibold tracking-tight">Review Concepts</h2>
          <p className="text-muted-foreground">
            Select the concept that best matches the Tyson label request.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={onBack} disabled={loading}>
            Back to Input
          </Button>
          <Button variant="secondary" onClick={onRegenerate} disabled={loading}>
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
            Regenerate All
          </Button>
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive">
          {error}
        </div>
      )}

      {loading && concepts.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-4 py-24">
          <Loader2 className="h-10 w-10 animate-spin text-primary" />
          <div className="text-center">
            <p className="font-medium">Generating 4 label concepts...</p>
            <p className="text-sm text-muted-foreground">
              Calling xAI Grok in parallel. This may take 30–60 seconds.
            </p>
          </div>
        </div>
      ) : (
        <div className="grid gap-6 sm:grid-cols-2">
          {concepts.map((concept) => {
            const isSelected = selectedConceptId === concept.id;

            return (
              <Card
                key={concept.id}
                className={`overflow-hidden transition-shadow ${
                  isSelected ? "ring-2 ring-primary" : ""
                }`}
              >
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base">Concept {concept.variant}</CardTitle>
                    <Badge variant={isSelected ? "default" : "secondary"}>
                      {isSelected ? "Selected" : `Variant ${concept.variant}`}
                    </Badge>
                  </div>
                  <CardDescription className="line-clamp-2 text-xs">
                    {concept.prompt.slice(0, 120)}...
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="relative aspect-[4/3] overflow-hidden rounded-lg bg-muted">
                    <Image
                      src={concept.imageDataUrl}
                      alt={`Label concept ${concept.variant}`}
                      fill
                      className="object-contain"
                      unoptimized
                    />
                    {loading && (
                      <div className="absolute inset-0 flex items-center justify-center bg-background/60">
                        <Loader2 className="h-8 w-8 animate-spin" />
                      </div>
                    )}
                  </div>
                  <Button
                    className="w-full"
                    variant={isSelected ? "default" : "outline"}
                    onClick={() => onSelect(concept)}
                    disabled={loading}
                  >
                    {isSelected ? (
                      <>
                        <Check className="h-4 w-4" />
                        Selected
                      </>
                    ) : (
                      "Select This Concept"
                    )}
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {loading && concepts.length > 0 && (
        <p className="text-center text-sm text-muted-foreground">
          Regenerating concepts — existing images will update when ready.
        </p>
      )}
    </div>
  );
}
