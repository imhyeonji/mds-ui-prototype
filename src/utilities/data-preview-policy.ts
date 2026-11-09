// Deliberately explicit: review another provider before extending this list.
const approvedHosts = new Set([
  "annualtrafficnumbers.connector.mds.think-it.io",
  "opendatahub-prod-1.connector.mds.think-it.io",
  "ua-mds-prod-1.connector.mds.think-it.io",
  "connector-mds-prod.edc.aws.bmw.cloud",
]);

export class PreviewError extends Error {
  constructor(message: string, public status = 400) { super(message); }
}

export function edcValue(object: unknown, name: string): unknown {
  if (!object || typeof object !== "object") return undefined;
  const record = object as Record<string, unknown>;
  const value = record[name] ?? record[`edc:${name}`] ?? record[`https://w3id.org/edc/v0.0.1/ns/${name}`];
  const first = Array.isArray(value) ? value[0] : value;
  return first && typeof first === "object" && "@value" in first ? first["@value"] : first;
}

export function approvedEndpoint(endpoint: unknown, counterPartyAddress: unknown): URL {
  let url: URL;
  let provider: URL;
  try {
    url = new URL(String(endpoint));
    provider = new URL(String(counterPartyAddress));
  } catch { throw new PreviewError("The transfer has no valid HTTP data endpoint."); }
  if (url.protocol !== "https:" || url.port || url.username || url.password || url.hash ||
      !approvedHosts.has(url.hostname) || provider.protocol !== "https:" || url.hostname !== provider.hostname ||
      !(url.pathname === "/public" || url.pathname.startsWith("/public/")) || /%2f|%5c|%2e/i.test(url.pathname)) {
    throw new PreviewError("This provider endpoint is not enabled for preview. Only approved HTTPS /public endpoints on the transfer's provider host are supported.", 403);
  }
  return url;
}

// Only public IPv4 routes are used. Pinning this address avoids DNS rebinding.
export function isPublicIPv4(address: string): boolean {
  const parts = address.split(".").map(Number);
  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) return false;
  const [a, b, c] = parts;
  return !(a === 0 || a === 10 || a === 127 || a >= 224 ||
    (a === 100 && b >= 64 && b <= 127) || (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) || (a === 192 && (b === 168 || b === 0 || (b === 88 && c === 99))) ||
    (a === 198 && (b === 18 || b === 19 || (b === 51 && c === 100))) ||
    (a === 203 && b === 0 && c === 113));
}

export function authorizationHeaders(address: unknown): Record<string, string> {
  const authorization = edcValue(address, "authorization");
  const authCode = edcValue(address, "authCode");
  const authKey = edcValue(address, "authKey");
  const value = authorization ?? authCode;
  const key = authorization ? "Authorization" : authKey;
  if (typeof value !== "string" || !value || value.length > 16384 || /[\r\n]/.test(value) ||
      typeof key !== "string" || !/^(authorization|x-api-key)$/i.test(key)) {
    throw new PreviewError("The EDR does not contain a supported Authorization or X-Api-Key credential.");
  }
  // Preserve the exact credential supplied by EDC; do not invent a Bearer prefix.
  return { [key]: value };
}
