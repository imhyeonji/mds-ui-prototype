// Layer 2 entry point: the `test` the specs use, with the data provider DSL as a fixture.
import { test as base } from '@playwright/test';
import { createOfferMetadataDriver } from '../drivers';
import type { OfferMetadataDriver } from './driver';
import { ProviderDsl } from './provider-dsl';

type AcceptanceFixtures = {
  /** Layer 3: the protocol driver that connects the DSL to the system. */
  offerMetadataDriver: OfferMetadataDriver;
  /** The data provider, speaking the language of the specs. */
  provider: ProviderDsl;
};

// The fixture callback is named `provide` rather than Playwright's usual `use`, which the
// React hooks lint rule would mistake for a hook.
export const test = base.extend<AcceptanceFixtures>({
  offerMetadataDriver: async ({}, provide) => {
    await provide(createOfferMetadataDriver());
  },
  provider: async ({ offerMetadataDriver }, provide) => {
    await provide(new ProviderDsl(offerMetadataDriver));
  },
});

export type { Band, OfferMetadata, OfferMetadataDriver, ScoreItem, Suggestion } from './driver';
