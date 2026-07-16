"use client";

import { FormEvent, useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  clearStoredTeamToken,
  getStoredTeamToken,
  setStoredTeamToken,
} from "@/lib/teamClient";

interface TeamAuthGateProps {
  children: React.ReactNode;
}

export function TeamAuthGate({ children }: TeamAuthGateProps) {
  const [checking, setChecking] = useState(true);
  const [authRequired, setAuthRequired] = useState(false);
  const [unlocked, setUnlocked] = useState(false);
  const [token, setToken] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function checkAuth() {
      try {
        const response = await fetch("/api/auth/login");
        const data = (await response.json()) as { authRequired?: boolean };
        if (cancelled) {
          return;
        }

        if (!data.authRequired) {
          setAuthRequired(false);
          setUnlocked(true);
          return;
        }

        setAuthRequired(true);
        const stored = getStoredTeamToken();
        if (!stored) {
          setUnlocked(false);
          return;
        }

        const verify = await fetch("/api/auth/login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token: stored }),
        });

        if (verify.ok) {
          setUnlocked(true);
        } else {
          clearStoredTeamToken();
          setUnlocked(false);
        }
      } catch {
        if (!cancelled) {
          setAuthRequired(false);
          setUnlocked(true);
        }
      } finally {
        if (!cancelled) {
          setChecking(false);
        }
      }
    }

    void checkAuth();
    return () => {
      cancelled = true;
    };
  }, []);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: token.trim() }),
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error ?? "Invalid token");
      }

      setStoredTeamToken(token.trim());
      setUnlocked(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to unlock");
    } finally {
      setSubmitting(false);
    }
  };

  if (checking) {
    return (
      <div className="mx-auto max-w-md py-16 text-center text-sm text-muted-foreground">
        Checking team access…
      </div>
    );
  }

  if (authRequired && !unlocked) {
    return (
      <Card className="mx-auto max-w-md">
        <CardHeader>
          <CardTitle>Team access</CardTitle>
          <CardDescription>
            Enter the shared team access token to use the artwork tool.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form className="space-y-4" onSubmit={handleSubmit}>
            <div className="space-y-2">
              <Label htmlFor="team-token">Access token</Label>
              <Input
                id="team-token"
                type="password"
                value={token}
                onChange={(event) => setToken(event.target.value)}
                autoComplete="current-password"
                required
              />
            </div>
            {error && (
              <p className="text-sm text-destructive">{error}</p>
            )}
            <Button type="submit" className="w-full" disabled={submitting}>
              {submitting ? "Unlocking…" : "Unlock"}
            </Button>
          </form>
        </CardContent>
      </Card>
    );
  }

  return <>{children}</>;
}
