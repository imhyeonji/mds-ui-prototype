import "server-only";
import { Resolver } from "node:dns/promises";
import { request } from "node:https";
import { approvedEndpoint, authorizationHeaders, isPublicIPv4, PreviewError } from "./data-preview-policy";

export const PREVIEW_MAX_BYTES = 2 * 1024 * 1024;

export async function fetchProviderPreview(endpoint: unknown, counterParty: unknown, address: unknown, signal: AbortSignal) {
  const url = approvedEndpoint(endpoint, counterParty);
  const headers = authorizationHeaders(address);
  const resolver = new Resolver({ timeout: 3000, tries: 1 });
  const cancel = () => resolver.cancel();
  signal.throwIfAborted();
  signal.addEventListener("abort", cancel, { once: true });
  let addresses: string[];
  try { addresses = await resolver.resolve4(url.hostname); }
  finally { signal.removeEventListener("abort", cancel); }
  signal.throwIfAborted();
  if (!addresses.length || addresses.some((ip) => !isPublicIPv4(ip))) {
    throw new PreviewError("The provider endpoint did not resolve to a public address.", 403);
  }
  return new Promise<{ status: number; statusText: string; contentType: string; body: string; bytes: number }>((resolve, reject) => {
    const req = request(url, {
      method: "GET", signal, agent: false, family: 4,
      lookup: (_hostname, _options, callback) => callback(null, addresses[0], 4),
      headers: { ...headers, Accept: "application/json, text/csv, text/plain;q=0.9", "Accept-Encoding": "identity" },
    }, (res) => {
      const status = res.statusCode || 502;
      const fail = (message: string, code = 502) => { res.destroy(); reject(new PreviewError(message, code)); };
      if (status >= 300 && status < 400) { fail("Provider redirects are blocked. Review the EDR endpoint before retrying."); return; }
      if (res.headers["content-encoding"] && res.headers["content-encoding"] !== "identity") { fail("Compressed provider responses are not supported in this preview yet."); return; }
      const contentType = res.headers["content-type"] || "";
      const mime = contentType.split(";")[0].trim().toLowerCase();
      if (mime && !(mime.startsWith("text/") || mime === "application/json" || mime.endsWith("+json") || mime === "application/csv")) {
        fail("This response is not JSON, CSV or text. Binary previews are not supported.", 415); return;
      }
      if (Number(res.headers["content-length"]) > PREVIEW_MAX_BYTES) { fail("Response exceeds the 2 MiB preview limit. No partial JSON was displayed.", 413); return; }
      const chunks: Buffer[] = [];
      let bytes = 0;
      res.on("data", (chunk: Buffer) => {
        bytes += chunk.length;
        if (bytes > PREVIEW_MAX_BYTES) { fail("Response exceeds the 2 MiB preview limit. No partial JSON was displayed.", 413); return; }
        chunks.push(chunk);
      });
      res.on("error", reject);
      res.on("end", () => {
        const charset = /charset\s*=\s*["']?([^;\s"']+)/i.exec(contentType)?.[1] || "utf-8";
        try {
          let body = new TextDecoder(charset, { fatal: true }).decode(Buffer.concat(chunks));
          // A provider error may echo its credential. Never send that credential back.
          for (const credential of Object.values(headers)) body = body.split(credential).join("[REDACTED]");
          resolve({ status, statusText: res.statusMessage || "", contentType, body, bytes });
        } catch { reject(new PreviewError("The provider response could not be decoded as text.", 415)); }
      });
    });
    req.on("error", reject);
    req.end();
  });
}
