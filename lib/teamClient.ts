import { TEAM_TOKEN_COOKIE, TEAM_TOKEN_HEADER } from "@/lib/teamAuthConstants";

const STORAGE_KEY = "tyson_team_token";

export function getStoredTeamToken(): string | null {
  if (typeof window === "undefined") {
    return null;
  }
  return window.localStorage.getItem(STORAGE_KEY);
}

export function setStoredTeamToken(token: string): void {
  window.localStorage.setItem(STORAGE_KEY, token);
  document.cookie = `${TEAM_TOKEN_COOKIE}=${encodeURIComponent(token)}; path=/; max-age=${60 * 60 * 24 * 365}; samesite=lax`;
}

export function clearStoredTeamToken(): void {
  window.localStorage.removeItem(STORAGE_KEY);
  document.cookie = `${TEAM_TOKEN_COOKIE}=; path=/; max-age=0; samesite=lax`;
}

export async function teamFetch(
  input: RequestInfo | URL,
  init: RequestInit = {},
): Promise<Response> {
  const headers = new Headers(init.headers);
  const token = getStoredTeamToken();
  if (token) {
    headers.set(TEAM_TOKEN_HEADER, token);
  }

  return fetch(input, {
    ...init,
    headers,
  });
}

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
