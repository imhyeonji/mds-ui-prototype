// The metadata quality score of an offer in the saved portal catalogue. The catalogue scores its
// offers with the same rules as the asset form, from the metadata each saved offer carries.
import type { AssetProperties } from "@/utilities/asset";
import type { PortalOffer } from "@/utilities/portal-catalog";
import {
  ASSET_ADVANCED_INFO_DATA_CATEGORY,
  ASSET_ADVANCED_INFO_MOBILITY_THEME,
  ASSET_DESCRIPTION,
  ASSET_KEYWORDS,
  ASSET_TITLE,
  ASSET_VERSION,
} from "@/jsonld/asset";
import { assessMetadataQuality, bandFor, type MetadataQuality } from "./assessment";

// DEMO ONLY: the saved catalogue carries too little metadata for any offer to score above 40, so these
// offers show fixed scores to demonstrate the Good and Excellent bands. 70 and 64 are what the asset
// form gives these offers' full metadata (see the reference-offers acceptance spec); 86 is made up.
// Remove this once the catalogue carries every scored field.
export const DEMO_SCORES: Record<string, number> = {
  "MDSLW30JNM.CSYI9O8:mds-local-hazard-prod-fleet": 86,
  "MDSLV9P5Z3.C6QF697:korean-flex-parking-usage-transactions-1.0": 70,
  "MDSL5WB4V8.CV901RD:mobito-anonymized-aggregated-vehicle-probe-data": 64,
};

/** The saved offer in the shape of the asset form's properties. Anything the offer does not carry stays empty. */
export const portalOfferProperties = (offer: PortalOffer): AssetProperties =>
  ({
    "@id": offer.assetId,
    [ASSET_TITLE]: offer.assetTitle ?? "",
    // The saved catalogue keeps line breaks as the two characters "\n".
    [ASSET_DESCRIPTION]: (offer.descriptionShortText ?? "").replaceAll("\\n", "\n"),
    [ASSET_KEYWORDS]: offer.keywords ?? [],
    [ASSET_VERSION]: offer.version ?? "",
    [ASSET_ADVANCED_INFO_MOBILITY_THEME]: { [ASSET_ADVANCED_INFO_DATA_CATEGORY]: offer.dataCategory ?? "" },
  }) as unknown as AssetProperties;

// Saved offers never change, so each one is scored once.
const assessed = new WeakMap<PortalOffer, MetadataQuality>();

export const assessPortalOffer = (offer: PortalOffer): MetadataQuality => {
  let quality = assessed.get(offer);
  if (!quality) {
    quality = assessMetadataQuality(portalOfferProperties(offer));
    const demoScore = DEMO_SCORES[`${offer.connectorId}:${offer.assetId}`];
    if (demoScore !== undefined) quality = { ...quality, score: demoScore, band: bandFor(demoScore) };
    assessed.set(offer, quality);
  }
  return quality;
};
