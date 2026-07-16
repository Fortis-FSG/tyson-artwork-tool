"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";

import { RequestWizard } from "@/components/RequestWizard";
import { TeamAuthGate } from "@/components/TeamAuthGate";
import { Button } from "@/components/ui/button";
import { teamFetch } from "@/lib/teamClient";
import type { SavedRequest } from "@/types";

interface RequestLoaderProps {
  id: string;
}

export function RequestLoader({ id }: RequestLoaderProps) {
  const [session, setSession] = useState<SavedRequest | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);
      try {
        const response = await teamFetch(`/api/sessions/${id}`);
        const data = await response.json();
        if (!response.ok) {
          throw new Error(data.error ?? "Failed to load request");
        }
        if (!cancelled) {
          setSession(data.session as SavedRequest);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load request");
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
  }, [id]);

  return (
    <TeamAuthGate>
      {loading && (
        <div className="flex items-center justify-center gap-2 py-16 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" />
          Loading saved request…
        </div>
      )}

      {!loading && error && (
        <div className="mx-auto max-w-lg space-y-4 py-16 text-center">
          <h1 className="text-xl font-semibold">Unable to open request</h1>
          <p className="text-sm text-muted-foreground">{error}</p>
          <Button asChild>
            <Link href="/">Back to dashboard</Link>
          </Button>
        </div>
      )}

      {!loading && !error && session && <RequestWizard initialSession={session} />}
    </TeamAuthGate>
  );
}
