import { NextResponse } from "next/server";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// A fixed, public dataset sample. Never accepts a caller-supplied file or URL.
export async function GET() {
  const body = await readFile(join(process.cwd(), "src/data/copenhagen-bicycle-parking.json"), "utf8");
  return NextResponse.json({
    source: "saved", addressSource: "saved", status: 200, statusText: "Saved response",
    contentType: "application/json", body, bytes: Buffer.byteLength(body),
    fetchedAt: "2026-09-24T21:57:37Z",
  }, { headers: { "Cache-Control": "no-store, private", "X-Content-Type-Options": "nosniff" } });
}
