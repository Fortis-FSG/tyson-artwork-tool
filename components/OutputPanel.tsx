"use client";

import { useState } from "react";
import Image from "next/image";
import { Check, Copy, Download, FileJson, FileText, RotateCcw } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { copyToClipboard, downloadDataUrl } from "@/lib/utils";
import type { ArtworkRequest, GeneratedConcept } from "@/types";

interface OutputPanelProps {
  artworkRequest: ArtworkRequest;
  designBrief: string;
  selectedConcept: GeneratedConcept;
  onStartOver: () => void;
  onBackToReview: () => void;
}

export function OutputPanel({
  artworkRequest,
  designBrief,
  selectedConcept,
  onStartOver,
  onBackToReview,
}: OutputPanelProps) {
  const [copiedJson, setCopiedJson] = useState(false);
  const [copiedBrief, setCopiedBrief] = useState(false);

  const jsonString = JSON.stringify(artworkRequest, null, 2);

  const handleCopyJson = async () => {
    const success = await copyToClipboard(jsonString);
    if (success) {
      setCopiedJson(true);
      setTimeout(() => setCopiedJson(false), 2000);
    }
  };

  const handleCopyBrief = async () => {
    const success = await copyToClipboard(designBrief);
    if (success) {
      setCopiedBrief(true);
      setTimeout(() => setCopiedBrief(false), 2000);
    }
  };

  const handleDownload = () => {
    downloadDataUrl(
      selectedConcept.imageDataUrl,
      `${artworkRequest.request_id}-concept-${selectedConcept.variant}.png`,
    );
  };

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-2xl font-semibold tracking-tight">Output Ready</h2>
            <Badge>{artworkRequest.request_id}</Badge>
            <Badge variant="secondary">{artworkRequest.urgency.toUpperCase()}</Badge>
          </div>
          <p className="text-muted-foreground">
            Structured JSON and design brief for prepress handoff.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={onBackToReview}>
            Back to Review
          </Button>
          <Button variant="secondary" onClick={onStartOver}>
            <RotateCcw className="h-4 w-4" />
            New Request
          </Button>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Selected Concept</CardTitle>
            <CardDescription>
              Concept {selectedConcept.variant} — {artworkRequest.customer}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="relative aspect-[4/3] overflow-hidden rounded-lg bg-muted">
              <Image
                src={selectedConcept.imageDataUrl}
                alt={`Selected concept ${selectedConcept.variant}`}
                fill
                className="object-contain"
                unoptimized
              />
            </div>
            <Button className="w-full" variant="outline" onClick={handleDownload}>
              <Download className="h-4 w-4" />
              Download Selected Image
            </Button>
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between gap-2">
                <div>
                  <CardTitle className="flex items-center gap-2 text-base">
                    <FileJson className="h-4 w-4" />
                    Structured JSON
                  </CardTitle>
                  <CardDescription>Parsed request fields for system integration.</CardDescription>
                </div>
                <Button size="sm" variant="outline" onClick={handleCopyJson}>
                  {copiedJson ? (
                    <>
                      <Check className="h-4 w-4" />
                      Copied
                    </>
                  ) : (
                    <>
                      <Copy className="h-4 w-4" />
                      Copy JSON
                    </>
                  )}
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <pre className="max-h-[280px] overflow-auto rounded-lg bg-muted p-4 text-xs leading-relaxed">
                {jsonString}
              </pre>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex items-center justify-between gap-2">
                <div>
                  <CardTitle className="flex items-center gap-2 text-base">
                    <FileText className="h-4 w-4" />
                    Design Brief
                  </CardTitle>
                  <CardDescription>Human-readable brief for the design team.</CardDescription>
                </div>
                <Button size="sm" variant="outline" onClick={handleCopyBrief}>
                  {copiedBrief ? (
                    <>
                      <Check className="h-4 w-4" />
                      Copied
                    </>
                  ) : (
                    <>
                      <Copy className="h-4 w-4" />
                      Copy Brief
                    </>
                  )}
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="max-h-[280px] overflow-auto rounded-lg border bg-background p-4">
                <article className="prose prose-sm max-w-none dark:prose-invert">
                  {designBrief.split("\n").map((line, index) => {
                    if (line.startsWith("# ")) {
                      return (
                        <h1 key={index} className="mb-2 text-lg font-bold">
                          {line.replace("# ", "")}
                        </h1>
                      );
                    }
                    if (line.startsWith("## ")) {
                      return (
                        <h2 key={index} className="mb-2 mt-4 text-base font-semibold">
                          {line.replace("## ", "")}
                        </h2>
                      );
                    }
                    if (line.startsWith("### ")) {
                      return (
                        <h3 key={index} className="mb-1 mt-3 text-sm font-semibold">
                          {line.replace("### ", "")}
                        </h3>
                      );
                    }
                    if (line.startsWith("- ")) {
                      return (
                        <p key={index} className="ml-2 text-sm text-muted-foreground">
                          {line}
                        </p>
                      );
                    }
                    if (line.startsWith("|")) {
                      return (
                        <p key={index} className="font-mono text-xs">
                          {line}
                        </p>
                      );
                    }
                    if (line.trim() === "---") {
                      return <Separator key={index} className="my-3" />;
                    }
                    if (line.trim() === "") {
                      return <br key={index} />;
                    }
                    return (
                      <p key={index} className="text-sm">
                        {line}
                      </p>
                    );
                  })}
                </article>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
