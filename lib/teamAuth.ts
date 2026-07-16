import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { TEAM_TOKEN_COOKIE, TEAM_TOKEN_HEADER } from "@/lib/teamAuthConstants";

export { TEAM_TOKEN_COOKIE, TEAM_TOKEN_HEADER };

export function getConfiguredTeamToken(): string | null {
  const token = process.env.TEAM_ACCESS_TOKEN?.trim();
  return token || null;
}

export function isTeamAuthConfigured(): boolean {
  return Boolean(getConfiguredTeamToken());
}

export function extractTeamToken(request: Request): string | null {
  const header = request.headers.get(TEAM_TOKEN_HEADER)?.trim();
  if (header) {
    return header;
  }

  const auth = request.headers.get("authorization");
  if (auth?.toLowerCase().startsWith("bearer ")) {
    const bearer = auth.slice(7).trim();
    if (bearer) {
      return bearer;
    }
  }

  const cookieHeader = request.headers.get("cookie");
  if (cookieHeader) {
    const match = cookieHeader
      .split(";")
      .map((part) => part.trim())
      .find((part) => part.startsWith(`${TEAM_TOKEN_COOKIE}=`));
    if (match) {
      return decodeURIComponent(match.split("=").slice(1).join("="));
    }
  }

  return null;
}

export function verifyTeamToken(provided: string | null): boolean {
  const expected = getConfiguredTeamToken();
  if (!expected) {
    return true;
  }
  return Boolean(provided && provided === expected);
}

export function unauthorizedResponse(): NextResponse {
  return NextResponse.json(
    { error: "Unauthorized. Provide a valid team access token." },
    { status: 401 },
  );
}

export function requireTeamAccess(request: Request): NextResponse | null {
  if (verifyTeamToken(extractTeamToken(request))) {
    return null;
  }
  return unauthorizedResponse();
}

export async function hasTeamAccessFromCookies(): Promise<boolean> {
  const expected = getConfiguredTeamToken();
  if (!expected) {
    return true;
  }
  const jar = await cookies();
  return jar.get(TEAM_TOKEN_COOKIE)?.value === expected;
}
