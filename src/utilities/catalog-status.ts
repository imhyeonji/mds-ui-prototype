import { edcValue } from "./data-preview-policy";
export type CatalogStatus = "contract" | "pending";
export const catalogStatusKey = (provider: string, asset: string) => JSON.stringify([provider, asset]);
const pending = new Set(["INITIAL", "REQUESTING", "REQUESTED", "CONSUMER_APPROVING", "CONSUMER_APPROVED", "PROVIDER_APPROVING", "PROVIDER_APPROVED", "OFFERING", "OFFERED", "ACCEPTING", "ACCEPTED", "AGREEING", "AGREED", "VERIFYING", "VERIFIED", "FINALIZING"]);
export function buildCatalogStatuses(agreements: unknown[], negotiations: unknown[], retirements: unknown[], participantId: string) {
  const result: Record<string, CatalogStatus> = {};
  const retired = new Set(retirements.map(r => edcValue(r, "agreementId")));
  for (const n of negotiations) {
    const provider = edcValue(n, "counterPartyId"), asset = edcValue(n, "assetId");
    if (edcValue(n, "type") === "CONSUMER" && pending.has(String(edcValue(n, "state"))) && typeof provider === "string" && typeof asset === "string") result[catalogStatusKey(provider, asset)] = "pending";
  }
  for (const a of agreements) {
    const provider = edcValue(a, "providerId"), asset = edcValue(a, "assetId");
    const id = edcValue(a, "agreementId") ?? (a as Record<string, unknown>)["@id"];
    if (edcValue(a, "consumerId") === participantId && !retired.has(id) && typeof provider === "string" && typeof asset === "string") result[catalogStatusKey(provider, asset)] = "contract";
  }
  return result;
}
