// Layer 3: the protocol drivers the DSL can run on.
import type { OfferMetadataDriver } from "../dsl/driver";
import { AssetFormDriver } from "./asset-form-driver";

/** The driver for one test. Each test gets its own, so tests never share an offer or a connector. */
export function createOfferMetadataDriver(): OfferMetadataDriver {
  return new AssetFormDriver();
}
