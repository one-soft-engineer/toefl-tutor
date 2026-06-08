import { NextResponse } from "next/server";
import { isLocalMode, getResultsEndpoint, getUploadToken } from "@/lib/env";

export async function POST(req: Request) {
  if (!isLocalMode()) {
    return NextResponse.json({ error: "not available" }, { status: 404 });
  }
  const body = await req.text();
  const res = await fetch(getResultsEndpoint(), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${getUploadToken()}`,
    },
    body,
  });
  if (!res.ok) {
    return NextResponse.json(
      { error: `upstream ${res.status}` },
      { status: 502 }
    );
  }
  return NextResponse.json({ ok: true });
}
