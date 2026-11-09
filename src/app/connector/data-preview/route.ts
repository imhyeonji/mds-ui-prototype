import { NextRequest, NextResponse } from "next/server";
import { getConnectorConfig } from "@/utilities/connector-config";
import { edcValue, PreviewError } from "@/utilities/data-preview-policy";
import { fetchProviderPreview } from "@/utilities/provider-data-preview";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const noStore = { "Cache-Control": "no-store, private", "X-Content-Type-Options": "nosniff" };

async function boundedText(response: Response, maxBytes: number, signal: AbortSignal) {
  const reader = response.body?.getReader();
  if (!reader) return "";
  const cancel = () => { void reader.cancel().catch(() => {}); };
  signal.addEventListener("abort", cancel, { once: true });
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      signal.throwIfAborted();
      const { done, value } = await reader.read();
      signal.throwIfAborted();
      if (done) break;
      size += value.length;
      if (size > maxBytes) { await reader.cancel(); throw new PreviewError("Connector response exceeds the preview metadata limit.", 413); }
      chunks.push(value);
    }
    return Buffer.concat(chunks).toString("utf8");
  } finally { signal.removeEventListener("abort", cancel); reader.releaseLock(); }
}

export async function POST(req: NextRequest) {
  // Same-origin POST only, following this app's existing connector access boundary.
  // No URL, method, credentials, headers or request body for the provider is accepted.
  const origin = req.headers.get("origin");
  const fetchSite = req.headers.get("sec-fetch-site");
  let sameHost = false;
  try { const parsed = new URL(origin || ""); sameHost = ["http:", "https:"].includes(parsed.protocol) && parsed.host === req.headers.get("host"); } catch { /* Reject malformed origins. */ }
  if (!sameHost || (fetchSite && fetchSite !== "same-origin") ||
      !req.headers.get("content-type")?.startsWith("application/json") || req.nextUrl.search) {
    return NextResponse.json({ error: "A same-origin JSON request is required." }, { status: 403, headers: noStore });
  }
  const controller = new AbortController();
  const signal = controller.signal;
  const cancel = () => controller.abort();
  const timer = setTimeout(cancel, 25000);
  req.signal.addEventListener("abort", cancel, { once: true });
  if (req.signal.aborted) cancel();
  try {
    const inputText = await boundedText(new Response(req.body), 1024, signal);
    let input;
    try { input = JSON.parse(inputText); } catch { throw new PreviewError("Invalid JSON request."); }
    const id = input?.transferProcessId;
    if (typeof id !== "string" || !/^[a-zA-Z0-9_-]{1,160}$/.test(id) || Object.keys(input).some((key) => key !== "transferProcessId")) {
      throw new PreviewError("Provide only a valid transfer process ID.");
    }
    const config = getConnectorConfig();
    const management = async (path: string, body?: unknown) => {
      const response = await fetch(`${config.managementUrl.replace(/\/$/, "")}${path}`, {
        method: body ? "POST" : "GET", redirect: "error", cache: "no-store", signal,
        headers: { "x-api-key": config.apiKey, "Content-Type": "application/json" },
        body: body ? JSON.stringify(body) : undefined,
      });
      if (!response.ok) { await response.body?.cancel(); throw new PreviewError(`Connector metadata request failed (HTTP ${response.status}).`, response.status === 404 ? 404 : 502); }
      return JSON.parse(await boundedText(response, 1024 * 1024, signal));
    };
    const transfer = await management(`/v3/transferprocesses/${encodeURIComponent(id)}`);
    if (edcValue(transfer, "type") !== "CONSUMER" || edcValue(transfer, "state") !== "STARTED" || edcValue(transfer, "transferType") !== "HttpData-PULL") {
      throw new PreviewError("Preview requires a STARTED consumer HttpData-PULL transfer.", 409);
    }
    // Use only a current EDR belonging to the selected transfer. A failed EDR lookup
    // must not silently fall back to potentially expired transfer credentials.
    const edrs = await management("/v3/edrs/request", {
        "@context": { "@vocab": "https://w3id.org/edc/v0.0.1/ns/" }, "@type": "QuerySpec",
        offset: 0, limit: 5, sortField: "createdAt", sortOrder: "DESC",
        filterExpression: [{ operandLeft: "transferProcessId", operator: "=", operandRight: id }],
      });
    const edr = Array.isArray(edrs) ? edrs.find((entry) => edcValue(entry, "transferProcessId") === id) : undefined;
    const edrId = edr?.["@id"];
    if (typeof edrId !== "string") throw new PreviewError("No current EDR is available for this transfer. Check the transfer and retry.", 404);
    const address = await management(`/v3/edrs/${encodeURIComponent(edrId)}/dataaddress`);
    // Current EDC transfer responses omit counterPartyAddress. Resolve it from
    // the negotiation attached to this transfer's agreement, never from the client.
    let counterPartyAddress = edcValue(transfer, "counterPartyAddress");
    if (typeof counterPartyAddress !== "string" || !counterPartyAddress) {
      const contractId = edcValue(transfer, "contractId");
      if (typeof contractId !== "string" || !contractId) throw new PreviewError("The transfer has no linked agreement to identify its provider.", 409);
      const negotiation = await management(`/v3/contractagreements/${encodeURIComponent(contractId)}/negotiation`);
      counterPartyAddress = edcValue(negotiation, "counterPartyAddress");
      if (typeof counterPartyAddress !== "string" || !counterPartyAddress) throw new PreviewError("The linked agreement does not provide a provider address.", 409);
    }
    const result = await fetchProviderPreview(edcValue(address, "endpoint"), counterPartyAddress, address, signal);
    return NextResponse.json({ ...result, fetchedAt: new Date().toISOString(), addressSource: "edr" }, { headers: noStore });
  } catch (error) {
    const known = error instanceof PreviewError;
    const timeout = signal.aborted || error instanceof Error && ["AbortError", "TimeoutError"].includes(error.name);
    return NextResponse.json({ error: known ? error.message : timeout ? "The preview request timed out or was cancelled. Try again." : "Could not retrieve provider data. Check that the connector and provider are reachable, then retry." }, { status: known ? error.status : timeout ? 504 : 502, headers: noStore });
  } finally {
    clearTimeout(timer);
    req.signal.removeEventListener("abort", cancel);
  }
}
