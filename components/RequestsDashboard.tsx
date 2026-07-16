"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { Loader2, Plus, Trash2 } from "lucide-react";

import { TeamAuthGate } from "@/components/TeamAuthGate";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { STATUS_LABELS, statusBadgeVariant } from "@/lib/requestStatus";
import { teamFetch } from "@/lib/teamClient";
import type { SavedRequestSummary } from "@/types";

function formatDate(value: string): string {
  try {
    return new Intl.DateTimeFormat(undefined, {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(new Date(value));
  } catch {
    return value;
  }
}

export function RequestsDashboard() {
  const [sessions, setSessions] = useState<SavedRequestSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const loadSessions = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await teamFetch("/api/sessions");
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error ?? "Failed to load requests");
      }
      setSessions(data.sessions as SavedRequestSummary[]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load requests");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadSessions();
  }, [loadSessions]);

  const handleDelete = async (id: string) => {
    if (!window.confirm("Delete this saved request and its concept images?")) {
      return;
    }
    setDeletingId(id);
    try {
      const response = await teamFetch(`/api/sessions/${id}`, { method: "DELETE" });
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error ?? "Failed to delete");
      }
      setSessions((prev) => prev.filter((session) => session.id !== id));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete request");
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <TeamAuthGate>
      <div className="mx-auto max-w-5xl space-y-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-1">
            <h1 className="text-2xl font-semibold tracking-tight">Saved requests</h1>
            <p className="text-muted-foreground">
              Reopen in-progress products anytime — concept options are kept until you delete them.
            </p>
          </div>
          <Button asChild>
            <Link href="/requests/new">
              <Plus className="h-4 w-4" />
              New Request
            </Link>
          </Button>
        </div>

        {error && (
          <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive">
            {error}
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center gap-2 py-16 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" />
            Loading saved requests…
          </div>
        ) : sessions.length === 0 ? (
          <Card>
            <CardHeader>
              <CardTitle>No saved requests yet</CardTitle>
              <CardDescription>
                Start a new request to generate concepts. They will auto-save so you can come back days later.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button asChild>
                <Link href="/requests/new">Start first request</Link>
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {sessions.map((session) => (
              <Card key={session.id}>
                <CardContent className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0 space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <Link
                        href={`/requests/${session.id}`}
                        className="truncate font-medium hover:underline"
                      >
                        {session.product || "Untitled product"}
                      </Link>
                      <Badge variant={statusBadgeVariant(session.status)}>
                        {STATUS_LABELS[session.status]}
                      </Badge>
                      <Badge variant="outline">{session.id}</Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {[
                        session.customer,
                        session.referenceNumber ? `Ref ${session.referenceNumber}` : null,
                        `${session.conceptCount} concept${session.conceptCount === 1 ? "" : "s"}`,
                        `Updated ${formatDate(session.updatedAt)}`,
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                    </p>
                    {session.customerApprovedConceptId && (
                      <p className="text-xs text-muted-foreground">
                        Customer approved a concept — open to continue handoff.
                      </p>
                    )}
                  </div>
                  <div className="flex shrink-0 gap-2">
                    <Button asChild variant="default">
                      <Link href={`/requests/${session.id}`}>Open</Link>
                    </Button>
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => void handleDelete(session.id)}
                      disabled={deletingId === session.id}
                      aria-label="Delete request"
                    >
                      {deletingId === session.id ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Trash2 className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </TeamAuthGate>
  );
}
