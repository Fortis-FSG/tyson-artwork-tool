"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useRef, useState } from "react";
import { ArrowLeft, Cloud, CloudOff, Loader2 } from "lucide-react";

import { EmailInput } from "@/components/EmailInput";
import { ImageGrid } from "@/components/ImageGrid";
import { OutputPanel } from "@/components/OutputPanel";
import { TeamAuthGate } from "@/components/TeamAuthGate";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { generateOutput } from "@/lib/generateOutput";
import { parseEmailText } from "@/lib/parseEmail";
import { STATUS_LABELS, statusBadgeVariant } from "@/lib/requestStatus";
import { teamFetch } from "@/lib/teamClient";
import { generateRequestId } from "@/lib/utils";
import type {
  AppStep,
  ArtworkRequest,
  GeneratedConcept,
  GenerateImagesResponse,
  RequestStatus,
  SavedRequest,
  UploadedReferenceImage,
} from "@/types";

const STEPS: { key: AppStep; label: string }[] = [
  { key: "input", label: "Input" },
  { key: "review", label: "Review" },
  { key: "output", label: "Output" },
];

type SaveState = "idle" | "saving" | "saved" | "error";

function getStepIndex(step: AppStep): number {
  if (step === "input" || step === "generating") {
    return 0;
  }
  if (step === "review") {
    return 1;
  }
  return 2;
}

interface RequestWizardProps {
  initialSession?: SavedRequest | null;
  isNew?: boolean;
}

export function RequestWizard({ initialSession = null, isNew = false }: RequestWizardProps) {
  const router = useRouter();
  const [requestId] = useState(initialSession?.id ?? generateRequestId());
  const [step, setStep] = useState<AppStep>(initialSession?.step ?? "input");
  const [status, setStatus] = useState<RequestStatus>(initialSession?.status ?? "draft");
  const [emailText, setEmailText] = useState(initialSession?.emailText ?? "");
  const [referenceImages, setReferenceImages] = useState<UploadedReferenceImage[]>(
    initialSession?.referenceImages ?? [],
  );
  const [attachmentContext, setAttachmentContext] = useState(
    initialSession?.attachmentContext ?? "",
  );
  const [concepts, setConcepts] = useState<GeneratedConcept[]>(
    initialSession?.concepts ?? [],
  );
  const [selectedConcept, setSelectedConcept] = useState<GeneratedConcept | null>(() => {
    if (!initialSession?.selectedConceptId) {
      return null;
    }
    return (
      initialSession.concepts.find((c) => c.id === initialSession.selectedConceptId) ??
      null
    );
  });
  const [artworkRequest, setArtworkRequest] = useState<ArtworkRequest | null>(
    initialSession?.artworkRequest ?? null,
  );
  const [designBrief, setDesignBrief] = useState(initialSession?.designBrief ?? "");
  const [shareToken, setShareToken] = useState<string | null>(
    initialSession?.shareToken ?? null,
  );
  const [customerApprovedConceptId, setCustomerApprovedConceptId] = useState<string | null>(
    initialSession?.customerApprovedConceptId ?? null,
  );
  const [customerComment, setCustomerComment] = useState<string | null>(
    initialSession?.customerComment ?? null,
  );
  const [createdAt] = useState(initialSession?.createdAt ?? new Date().toISOString());
  const [error, setError] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isRegenerating, setIsRegenerating] = useState(false);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [saveError, setSaveError] = useState<string | null>(null);
  const persistedRef = useRef(!isNew && Boolean(initialSession));
  const saveSeq = useRef(0);

  const buildSessionPayload = useCallback(
    (overrides: Partial<SavedRequest> = {}): SavedRequest => {
      const parsed = emailText.trim() ? parseEmailText(emailText) : null;
      return {
        id: requestId,
        status: overrides.status ?? status,
        step: overrides.step ?? step,
        emailText,
        attachmentContext,
        product: overrides.product ?? parsed?.product ?? artworkRequest?.product ?? null,
        customer:
          overrides.customer ?? parsed?.customer ?? artworkRequest?.customer ?? null,
        referenceNumber:
          overrides.referenceNumber ??
          parsed?.referenceNumber ??
          artworkRequest?.reference_number ??
          null,
        urgency: overrides.urgency ?? parsed?.urgency ?? artworkRequest?.urgency ?? "standard",
        concepts: overrides.concepts ?? concepts,
        referenceImages: overrides.referenceImages ?? referenceImages,
        selectedConceptId:
          overrides.selectedConceptId ?? selectedConcept?.id ?? null,
        customerApprovedConceptId:
          overrides.customerApprovedConceptId ?? customerApprovedConceptId,
        customerComment: overrides.customerComment ?? customerComment,
        artworkRequest: overrides.artworkRequest ?? artworkRequest,
        designBrief: overrides.designBrief ?? designBrief,
        shareToken: overrides.shareToken ?? shareToken,
        createdAt,
        updatedAt: new Date().toISOString(),
      };
    },
    [
      requestId,
      status,
      step,
      emailText,
      attachmentContext,
      concepts,
      referenceImages,
      selectedConcept,
      customerApprovedConceptId,
      customerComment,
      artworkRequest,
      designBrief,
      shareToken,
      createdAt,
    ],
  );

  const saveSession = useCallback(
    async (overrides: Partial<SavedRequest> = {}) => {
      const seq = ++saveSeq.current;
      setSaveState("saving");
      setSaveError(null);

      try {
        const payload = buildSessionPayload(overrides);
        const response = await teamFetch("/api/sessions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error ?? "Failed to save request");
        }

        if (seq !== saveSeq.current) {
          return data.session as SavedRequest;
        }

        const saved = data.session as SavedRequest;
        setConcepts(saved.concepts);
        setReferenceImages(saved.referenceImages);
        setStatus(saved.status);
        setShareToken(saved.shareToken);
        setCustomerApprovedConceptId(saved.customerApprovedConceptId);
        setCustomerComment(saved.customerComment);
        if (saved.selectedConceptId) {
          const nextSelected =
            saved.concepts.find((c) => c.id === saved.selectedConceptId) ?? null;
          setSelectedConcept(nextSelected);
        }
        if (saved.artworkRequest) {
          setArtworkRequest(saved.artworkRequest);
        }
        if (saved.designBrief) {
          setDesignBrief(saved.designBrief);
        }

        if (!persistedRef.current) {
          persistedRef.current = true;
          router.replace(`/requests/${saved.id}`);
        }

        setSaveState("saved");
        return saved;
      } catch (err) {
        if (seq === saveSeq.current) {
          setSaveState("error");
          setSaveError(err instanceof Error ? err.message : "Save failed");
        }
        throw err;
      }
    },
    [buildSessionPayload, router],
  );

  const generateImages = useCallback(async () => {
    setError(null);
    setIsGenerating(true);
    setStep("generating");

    try {
      const response = await teamFetch("/api/generate-images", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          emailText,
          referenceImages,
          attachmentContext,
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

      await saveSession({
        concepts: result.concepts,
        step: "review",
        selectedConceptId: null,
        artworkRequest: null,
        designBrief: "",
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "An unexpected error occurred");
      setStep("input");
    } finally {
      setIsGenerating(false);
      setIsRegenerating(false);
    }
  }, [emailText, referenceImages, attachmentContext, saveSession]);

  const handleRegenerate = useCallback(async () => {
    setIsRegenerating(true);
    await generateImages();
  }, [generateImages]);

  const handleSelectConcept = useCallback(
    async (concept: GeneratedConcept) => {
      setSelectedConcept(concept);
      setError(null);

      const referenceImageNames = referenceImages.map((image) => image.name);
      let nextArtworkRequest: ArtworkRequest | null = null;
      let nextDesignBrief = "";

      try {
        const response = await teamFetch("/api/generate-output", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            emailText,
            selectedConcept: concept,
            referenceImageNames,
            attachmentContext,
          }),
        });

        if (!response.ok) {
          const data = await response.json();
          throw new Error(data.error ?? "Failed to generate output");
        }

        const data = await response.json();
        nextArtworkRequest = {
          ...data.artworkRequest,
          request_id: requestId,
        };
        nextDesignBrief = data.designBrief;
      } catch {
        const fallback = generateOutput(
          emailText,
          concept,
          referenceImageNames,
          attachmentContext,
        );
        nextArtworkRequest = {
          ...fallback.artworkRequest,
          request_id: requestId,
        };
        nextDesignBrief = fallback.designBrief;
      }

      setArtworkRequest(nextArtworkRequest);
      setDesignBrief(nextDesignBrief);
      setStep("output");

      const nextStatus: RequestStatus =
        status === "customer_approved" || status === "handed_off"
          ? status
          : status === "awaiting_customer"
            ? "awaiting_customer"
            : "draft";

      await saveSession({
        selectedConceptId: concept.id,
        artworkRequest: nextArtworkRequest,
        designBrief: nextDesignBrief,
        step: "output",
        status: nextStatus,
      });
    },
    [emailText, referenceImages, attachmentContext, saveSession, status, requestId],
  );

  const handleMarkHandedOff = useCallback(async () => {
    setStatus("handed_off");
    await saveSession({ status: "handed_off", step: "output" });
  }, [saveSession]);

  const handleShareCreated = useCallback(
    (next: { shareToken: string; status: RequestStatus }) => {
      setShareToken(next.shareToken);
      setStatus(next.status);
    },
    [],
  );

  const handleStartOver = useCallback(() => {
    router.push("/requests/new");
  }, [router]);

  const currentStepIndex = getStepIndex(step);

  const content = (
      <div className="space-y-8">
        <div className="mx-auto flex max-w-7xl flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap items-center gap-2">
            <Button asChild variant="ghost" size="sm">
              <Link href="/">
                <ArrowLeft className="h-4 w-4" />
                All requests
              </Link>
            </Button>
            <Badge variant="outline">{requestId}</Badge>
            <Badge variant={statusBadgeVariant(status)}>{STATUS_LABELS[status]}</Badge>
            {customerApprovedConceptId && (
              <Badge variant="secondary">
                Customer picked concept{" "}
                {concepts.find((c) => c.id === customerApprovedConceptId)?.variant ?? ""}
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            {saveState === "saving" && (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Saving…
              </>
            )}
            {saveState === "saved" && (
              <>
                <Cloud className="h-3.5 w-3.5" />
                Saved
              </>
            )}
            {saveState === "error" && (
              <>
                <CloudOff className="h-3.5 w-3.5 text-destructive" />
                <span className="text-destructive">{saveError ?? "Save failed"}</span>
                <Button size="sm" variant="outline" onClick={() => void saveSession()}>
                  Retry
                </Button>
              </>
            )}
            {saveState === "idle" && persistedRef.current && (
              <>
                <Cloud className="h-3.5 w-3.5" />
                Ready to save
              </>
            )}
          </div>
        </div>

        {customerComment && (
          <div className="mx-auto max-w-3xl rounded-lg border bg-muted/40 p-4 text-sm">
            <p className="font-medium">Customer comment</p>
            <p className="text-muted-foreground">{customerComment}</p>
          </div>
        )}

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
            referenceImages={referenceImages}
            attachmentContext={attachmentContext}
            isGenerating={isGenerating}
            onEmailTextChange={setEmailText}
            onReferenceImagesChange={setReferenceImages}
            onAttachmentContextChange={setAttachmentContext}
            onGenerate={generateImages}
          />
        )}

        {(step === "generating" || step === "review") && (
          <ImageGrid
            concepts={concepts}
            isGenerating={step === "generating" && !isRegenerating}
            isRegenerating={isRegenerating}
            selectedConceptId={selectedConcept?.id ?? null}
            customerApprovedConceptId={customerApprovedConceptId}
            requestId={requestId}
            product={
              artworkRequest?.product ??
              (emailText.trim() ? parseEmailText(emailText).product : null)
            }
            shareToken={shareToken}
            error={step === "review" ? error : null}
            onSelect={handleSelectConcept}
            onRegenerate={handleRegenerate}
            onShareCreated={handleShareCreated}
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
            concepts={concepts}
            requestId={requestId}
            shareToken={shareToken}
            status={status}
            onStartOver={handleStartOver}
            onBackToReview={() => setStep("review")}
            onShareCreated={handleShareCreated}
            onMarkHandedOff={handleMarkHandedOff}
          />
        )}
      </div>
  );

  if (isNew) {
    return <TeamAuthGate>{content}</TeamAuthGate>;
  }

  return content;
}
