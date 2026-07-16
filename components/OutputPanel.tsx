"use client";

import { useMemo, useState } from "react";
import Image from "next/image";
import {
  Check,
  Copy,
  Download,
  FileJson,
  FileText,
  Link2,
  Loader2,
  RotateCcw,
} from "lucide-react";

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
import { downloadConceptsAsZip, downloadSelectedConcepts } from "@/lib/clientZip";
import { copyToClipboard, downloadDataUrl } from "@/lib/utils";
import { downloadBlob, teamFetch } from "@/lib/teamClient";
import type {
  ArtworkRequest,
  GeneratedConcept,
  RequestStatus,
} from "@/types";

interface OutputPanelProps {
  artworkRequest: ArtworkRequest;
  designBrief: string;
  selectedConcept: GeneratedConcept;
  concepts: GeneratedConcept[];
  requestId: string;
  shareToken: string | null;
  status: RequestStatus;
  onStartOver: () => void;
  onBackToReview: () => void;
  onShareCreated: (next: { shareToken: string; status: RequestStatus }) => void;
  onMarkHandedOff: () => void;
}

export function OutputPanel({
  artworkRequest,
  designBrief,
  selectedConcept,
  concepts,
  requestId,
  shareToken,
  status,
  onStartOver,
  onBackToReview,
  onShareCreated,
  onMarkHandedOff,
}: OutputPanelProps) {
  const [copiedJson, setCopiedJson] = useState(false);
  const [copiedBrief, setCopiedBrief] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [downloadIds, setDownloadIds] = useState<string[]>(() =>
    concepts.map((c) => c.id),
  );
  const [busy, setBusy] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const jsonString = JSON.stringify(artworkRequest, null, 2);
  const selectedForDownload = useMemo(
    () => concepts.filter((c) => downloadIds.includes(c.id)),
    [concepts, downloadIds],
  );

  const reviewUrl =
    typeof window !== "undefined" && shareToken
      ? `${window.location.origin}/review/${shareToken}`
      : shareToken
        ? `/review/${shareToken}`
        : null;

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

  const toggleDownloadId = (id: string) => {
    setDownloadIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id],
    );
  };

  const handleDownloadSelected = async () => {
    if (selectedForDownload.length === 0) {
      return;
    }
    setBusy("download");
    setActionError(null);
    try {
      await downloadSelectedConcepts(selectedForDownload, requestId);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Download failed");
    } finally {
      setBusy(null);
    }
  };

  const handleCustomerPack = async () => {
    const packConcepts =
      selectedForDownload.length > 0 ? selectedForDownload : concepts;
    setBusy("zip");
    setActionError(null);
    try {
      try {
        await downloadConceptsAsZip({
          requestId,
          product: artworkRequest.product,
          concepts: packConcepts,
        });
      } catch {
        const response = await teamFetch(`/api/sessions/${requestId}/export-zip`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ conceptIds: packConcepts.map((c) => c.id) }),
        });
        if (!response.ok) {
          const data = await response.json();
          throw new Error(data.error ?? "Failed to export ZIP");
        }
        const blob = await response.blob();
        downloadBlob(blob, `${requestId}-customer-review.zip`);
      }
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "ZIP export failed");
    } finally {
      setBusy(null);
    }
  };

  const handleShareLink = async () => {
    setBusy("share");
    setActionError(null);
    try {
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

      const url = data.reviewUrl as string;
      const copied = await copyToClipboard(url);
      if (copied) {
        setCopiedLink(true);
        setTimeout(() => setCopiedLink(false), 2000);
      }
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Share link failed");
    } finally {
      setBusy(null);
    }
  };

  const handleCopyExistingLink = async () => {
    if (!reviewUrl) {
      return;
    }
    const copied = await copyToClipboard(reviewUrl);
    if (copied) {
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
    }
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
            Structured JSON and design brief for prepress handoff. Send concepts to the customer via ZIP or share link.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={onBackToReview}>
            Back to Review
          </Button>
          {status !== "handed_off" && (
            <Button variant="outline" onClick={onMarkHandedOff}>
              Mark handed off
            </Button>
          )}
          <Button variant="secondary" onClick={onStartOver}>
            <RotateCcw className="h-4 w-4" />
            New Request
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Customer review options</CardTitle>
          <CardDescription>
            Download a ZIP pack or copy a shareable approval link. Customer picks are advisory — you still control the final prepress selection.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            {concepts.map((concept) => (
              <label
                key={concept.id}
                className="flex items-center gap-3 rounded-md border p-3 text-sm"
              >
                <input
                  type="checkbox"
                  className="h-4 w-4 accent-primary"
                  checked={downloadIds.includes(concept.id)}
                  onChange={() => toggleDownloadId(concept.id)}
                />
                <span className="relative h-12 w-16 overflow-hidden rounded bg-muted">
                  <Image
                    src={concept.imageDataUrl}
                    alt={`Concept ${concept.variant}`}
                    fill
                    className="object-contain"
                    unoptimized
                  />
                </span>
                Concept {concept.variant}
                {concept.id === selectedConcept.id && (
                  <Badge variant="secondary">Prepress</Badge>
                )}
              </label>
            ))}
          </div>

          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              disabled={Boolean(busy) || selectedForDownload.length === 0}
              onClick={() => void handleDownloadSelected()}
            >
              {busy === "download" ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Download className="h-4 w-4" />
              )}
              Download selected
            </Button>
            <Button
              variant="secondary"
              disabled={Boolean(busy) || concepts.length === 0}
              onClick={() => void handleCustomerPack()}
            >
              {busy === "zip" ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Download className="h-4 w-4" />
              )}
              Customer pack (ZIP)
            </Button>
            <Button
              disabled={Boolean(busy)}
              onClick={() => void (shareToken ? handleCopyExistingLink() : handleShareLink())}
            >
              {busy === "share" ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : copiedLink ? (
                <Check className="h-4 w-4" />
              ) : (
                <Link2 className="h-4 w-4" />
              )}
              {copiedLink
                ? "Link copied"
                : shareToken
                  ? "Copy customer review link"
                  : "Create & copy review link"}
            </Button>
          </div>

          {reviewUrl && (
            <p className="break-all text-xs text-muted-foreground">{reviewUrl}</p>
          )}
          {actionError && (
            <p className="text-sm text-destructive">{actionError}</p>
          )}
        </CardContent>
      </Card>

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
