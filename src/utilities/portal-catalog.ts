import type { Catalog } from "@think-it-labs/edc-connector-client";

export interface PortalOffer {
  assetId: string;
  assetTitle: string;
  descriptionShortText: string;
  connectorId: string;
  connectorEndpoint?: string;
  organizationId: string;
  organizationName: string;
  assetDataSourceAvailability: string;
  dataCategory: string;
  version: string;
  keywords: string[];
  connectorOnlineStatus: string;
}

export function filterPortalOffers(offers: PortalOffer[], query: string, organization: string, category: string, sort: string) {
  const search = query.trim().toLowerCase();
  const filtered = offers.filter((offer) =>
    (!organization || offer.organizationId === organization) &&
    (!category || offer.dataCategory === category) &&
    [offer.assetTitle, offer.assetId, offer.descriptionShortText, offer.organizationName].some((value) => value.toLowerCase().includes(search)),
  );
  if (sort === "title") filtered.sort((a, b) => a.assetTitle.localeCompare(b.assetTitle));
  return filtered;
}

export function categoryLabel(category: string) {
  return category ? category.toLowerCase().replaceAll("_", " ").replace(/^./, (letter) => letter.toUpperCase()) : "Not provided";
}

/** Never open negotiation for another provider or another asset from a cached card. */
export function resolvePortalDataset(catalog: Catalog, offer: PortalOffer) {
  const identity = catalog.participantId || catalog["https://w3id.org/dspace/2025/1/participantId"]?.[0]?.["@id"];
  if (identity !== offer.connectorId) return { error: "The provider identity could not be verified. Please retry later." };
  const dataset = catalog.datasets.find((item) => item.id === offer.assetId);
  if (!dataset) return { error: "This dataset is no longer available from this provider, or access is restricted." };
  return { dataset, participantId: identity as string };
}
