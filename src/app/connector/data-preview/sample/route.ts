import { NextResponse } from "next/server";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const NO_STORE = { "Cache-Control": "no-store, private", "X-Content-Type-Options": "nosniff" };

// A fixed, saved /v1/explore summary of the Copenhagen sample. Never accepts a caller-supplied file or URL.
export async function GET() {
  try {
    const body = await readFile(join(process.cwd(), "src/data/copenhagen-explore.json"), "utf8");
    return new NextResponse(body, { headers: { ...NO_STORE, "Content-Type": "application/json" } });
  } catch {
    return NextResponse.json({ error: "The saved sample summary is not available." }, { status: 404, headers: NO_STORE });
  }
}
