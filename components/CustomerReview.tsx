"use client";

import Image from "next/image";
import { FormEvent, useEffect, useState } from "react";
import { Check, Loader2 } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { CustomerReviewPayload } from "@/types";

interface CustomerReviewProps {
  token: string;
}

export function CustomerReview({ token }: CustomerReviewProps) {
  const [review, setReview] = useState<CustomerReviewPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch(`/api/review/${token}`);
        const data = await response.json();
        if (!response.ok) {
          throw new Error(data.error ?? "Review not found");
        }
        if (cancelled) {
          return;
        }
        const payload = data.review as CustomerReviewPayload;
        setReview(payload);
        setSelectedId(payload.approvedConceptId);
        setSubmitted(payload.alreadyApproved);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load review");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [token]);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!selectedId) {
      setError("Please select a concept to approve.");
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const response = await fetch(`/api/review/${token}/approve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          conceptId: selectedId,
          comment: comment.trim() || undefined,
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error ?? "Failed to submit approval");
      }
      setSubmitted(true);
      setReview((prev) =>
        prev
          ? {
              ...prev,
              alreadyApproved: true,
              approvedConceptId: selectedId,
            }
          : prev,
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to submit");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center gap-2 py-24 text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin" />
        Loading concepts…
      </div>
    );
  }

  if (error && !review) {
    return (
      <div className="mx-auto max-w-lg rounded-lg border border-destructive/50 bg-destructive/10 p-6 text-center text-sm text-destructive">
        {error}
      </div>
    );
  }

  if (!review) {
    return null;
  }

  if (submitted) {
    const approved = review.concepts.find((c) => c.id === review.approvedConceptId);
    return (
      <Card className="mx-auto max-w-xl">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Check className="h-5 w-5" />
            Thank you
          </CardTitle>
          <CardDescription>
            Your selection has been sent to the artwork team.
            {approved ? ` You approved Concept ${approved.variant}.` : ""}
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="space-y-1 text-center">
        <h1 className="text-2xl font-semibold tracking-tight">Review artwork concepts</h1>
        <p className="text-muted-foreground">
          {review.product
            ? `Choose the concept you prefer for ${review.product}.`
            : "Choose the concept you prefer."}
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="grid gap-4 sm:grid-cols-2">
          {review.concepts.map((concept) => {
            const selected = selectedId === concept.id;
            return (
              <button
                key={concept.id}
                type="button"
                onClick={() => setSelectedId(concept.id)}
                className={`overflow-hidden rounded-lg border text-left transition ${
                  selected ? "ring-2 ring-primary" : "hover:border-foreground/30"
                }`}
              >
                <div className="flex items-center justify-between px-4 py-3">
                  <span className="font-medium">Concept {concept.variant}</span>
                  {selected && <Badge>Selected</Badge>}
                </div>
                <div className="relative aspect-[4/3] bg-muted">
                  <Image
                    src={concept.imageUrl}
                    alt={`Concept ${concept.variant}`}
                    fill
                    className="object-contain"
                    unoptimized
                  />
                </div>
              </button>
            );
          })}
        </div>

        <div className="space-y-2">
          <Label htmlFor="comment">Comment (optional)</Label>
          <Textarea
            id="comment"
            value={comment}
            onChange={(event) => setComment(event.target.value)}
            placeholder="Any notes for the team…"
            rows={3}
          />
        </div>

        {error && <p className="text-sm text-destructive">{error}</p>}

        <div className="flex justify-center">
          <Button type="submit" disabled={submitting || !selectedId}>
            {submitting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Submitting…
              </>
            ) : (
              "Submit approval"
            )}
          </Button>
        </div>
      </form>
    </div>
  );
}
