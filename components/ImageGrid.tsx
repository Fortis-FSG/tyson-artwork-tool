"use client";

import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import { Check, Download, Link2, Loader2, RefreshCw } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { downloadConceptsAsZip, downloadSelectedConcepts } from "@/lib/clientZip";
import { copyToClipboard } from "@/lib/utils";
import { teamFetch } from "@/lib/teamClient";
import type { GeneratedConcept, RequestStatus } from "@/types";

interface ImageGridProps {
  concepts: GeneratedConcept[];
  isGenerating: boolean;
  isRegenerating: boolean;
  selectedConceptId: string | null;
  customerApprovedConceptId?: string | null;
  requestId: string;
  product: string | null;
  shareToken?: string | null;
  error: string | null;
  onSelect: (concept: GeneratedConcept) => void;
  onRegenerate: () => void;
  onBack: () => void;
  onShareCreated?: (next: { shareToken: string; status: RequestStatus }) => void;
}

export function ImageGrid({
  concepts,
  isGenerating,
  isRegenerating,
  selectedConceptId,
  customerApprovedConceptId = null,
  requestId,
  product,
  shareToken = null,
  error,
  onSelect,
  onRegenerate,
  onBack,
  onShareCreated,
}: ImageGridProps) {
  const loading = isGenerating || isRegenerating;
  const conceptIds = useMemo(() => concepts.map((c) => c.id), [concepts]);
  const [downloadIds, setDownloadIds] = useState<string[]>(conceptIds);
  const [downloading, setDownloading] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);

  useEffect(() => {
    setDownloadIds(concepts.map((c) => c.id));
  }, [concepts]);

  const toggleDownloadId = (id: string) => {
    setDownloadIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id],
    );
  };

  const selectedForDownload = concepts.filter((c) => downloadIds.includes(c.id));

  const handleDownloadSelected = async () => {
    if (selectedForDownload.length === 0) {
      return;
    }
    setDownloading(true);
    try {
      await downloadSelectedConcepts(selectedForDownload, requestId);
    } finally {
      setDownloading(false);
    }
  };

  const handleCustomerPack = async () => {
    const packConcepts =
      selectedForDownload.length > 0 ? selectedForDownload : concepts;
    if (packConcepts.length === 0) {
      return;
    }
    setDownloading(true);
    try {
      await downloadConceptsAsZip({
        requestId,
        product,
        concepts: packConcepts,
      });
    } finally {
      setDownloading(false);
    }
  };

  const handleShareLink = async () => {
    if (!onShareCreated) {
      return;
    }
    setSharing(true);
    try {
      let url: string | null =
        shareToken && typeof window !== "undefined"
          ? `${window.location.origin}/review/${shareToken}`
          : null;

      if (!shareToken) {
        const response = await teamFetch(`/api/sessions/${requestId}/share`, {
          method: "POST",
        });
        const data = await response.json();
        if (!response.ok) {
          throw new Error(data.error ?? "Failed to create share link");
        }
        onShareCreated({
          shareToken: data.shareToken as string,
          status: data.session.status as RequestStatus,
        });
        url = data.reviewUrl as string;
      }

      if (url) {
        const copied = await copyToClipboard(url);
        if (copied) {
          setLinkCopied(true);
          setTimeout(() => setLinkCopied(false), 2000);
        }
      }
    } finally {
      setSharing(false);
    }
  };

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <h2 className="text-2xl font-semibold tracking-tight">Review Concepts</h2>
          <p className="text-muted-foreground">
            Select the concept for prepress, or download options for the customer.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
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

      {concepts.length > 0 && !loading && (
        <div className="flex flex-wrap items-center gap-2 rounded-lg border bg-muted/30 p-3">
          <span className="text-sm font-medium">Download for customer:</span>
          <Button
            size="sm"
            variant="outline"
            disabled={downloading || selectedForDownload.length === 0}
            onClick={() => void handleDownloadSelected()}
          >
            {downloading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Download className="h-4 w-4" />
            )}
            Download selected
          </Button>
          <Button
            size="sm"
            variant="secondary"
            disabled={downloading || concepts.length === 0}
            onClick={() => void handleCustomerPack()}
          >
            <Download className="h-4 w-4" />
            Customer pack (ZIP)
          </Button>
          {onShareCreated && (
            <Button
              size="sm"
              disabled={sharing || concepts.length === 0}
              onClick={() => void handleShareLink()}
            >
              {sharing ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : linkCopied ? (
                <Check className="h-4 w-4" />
              ) : (
                <Link2 className="h-4 w-4" />
              )}
              {linkCopied
                ? "Link copied"
                : shareToken
                  ? "Copy review link"
                  : "Create review link"}
            </Button>
          )}
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setDownloadIds(concepts.map((c) => c.id))}
          >
            Select all
          </Button>
        </div>
      )}

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
            const isCustomerPick = customerApprovedConceptId === concept.id;
            const includeInDownload = downloadIds.includes(concept.id);

            return (
              <Card
                key={concept.id}
                className={`overflow-hidden transition-shadow ${
                  isSelected ? "ring-2 ring-primary" : ""
                }`}
              >
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between gap-2">
                    <CardTitle className="text-base">Concept {concept.variant}</CardTitle>
                    <div className="flex flex-wrap justify-end gap-1">
                      {isCustomerPick && <Badge>Customer approved</Badge>}
                      <Badge variant={isSelected ? "default" : "secondary"}>
                        {isSelected ? "Selected" : `Variant ${concept.variant}`}
                      </Badge>
                    </div>
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
                  <label className="flex items-center gap-2 text-sm text-muted-foreground">
                    <input
                      type="checkbox"
                      className="h-4 w-4 accent-primary"
                      checked={includeInDownload}
                      onChange={() => toggleDownloadId(concept.id)}
                      disabled={loading}
                    />
                    Include in customer download
                  </label>
                  <Button
                    className="w-full"
                    variant={isSelected ? "default" : "outline"}
                    onClick={() => onSelect(concept)}
                    disabled={loading}
                  >
                    {isSelected ? (
                      <>
                        <Check className="h-4 w-4" />
                        Selected for prepress
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
