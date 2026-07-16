import { NextResponse } from "next/server";

import {
  getConfiguredTeamToken,
  TEAM_TOKEN_COOKIE,
  verifyTeamToken,
} from "@/lib/teamAuth";

export async function POST(request: Request) {
  const configured = getConfiguredTeamToken();
  if (!configured) {
    return NextResponse.json({ ok: true, authRequired: false });
  }

  try {
    const body = (await request.json()) as { token?: string };
    if (!verifyTeamToken(body.token ?? null)) {
      return NextResponse.json({ error: "Invalid team access token" }, { status: 401 });
    }

    const response = NextResponse.json({ ok: true, authRequired: true });
    response.cookies.set(TEAM_TOKEN_COOKIE, body.token!, {
      httpOnly: false,
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 365,
    });
    return response;
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
}

export async function GET() {
  return NextResponse.json({
    authRequired: Boolean(getConfiguredTeamToken()),
  });
}
