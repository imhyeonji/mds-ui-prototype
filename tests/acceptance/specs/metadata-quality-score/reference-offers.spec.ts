// Layer 1: executable specification. Business behaviour only; every step goes through the domain DSL.
import { test } from '../../dsl';

// For the same metadata, the score while describing an offer must equal the score in the
// catalogue. These reference offers come from the production MDS catalogue (read on 2026-11-06),
// and their expected scores come from the scoring rules v1. The catalogue did not return data
// subcategories, so the reference metadata has none.

test.describe('The provider sees the same score the catalogue will show', () => {
  const referenceOffers = [
    { offer: 'Korean flex parking usage transactions', score: 70, band: 'Good' },
    { offer: 'Mobito Anonymized Aggregated Vehicle Probe Data', score: 64, band: 'Good' },
    { offer: 'NEXTLOGIC DEMO Freight traffic (synthetic)', score: 56, band: 'Good' },
    { offer: 'BMW Accident', score: 36, band: 'Fair' },
    { offer: 'Mobilithek Test Asset', score: 8, band: 'Basic' },
    { offer: 'IAV Logo 12', score: 6, band: 'Basic' },
    { offer: 'eacde66e-5bab-4af4-ad79-0171a07b1a2f', score: 1, band: 'Basic' },
  ] as const;

  for (const { offer, score, band } of referenceOffers) {
    test(`"${offer}" scores ${score}`, async ({ provider }) => {
      await provider.hasExistingOfferLikeCatalogueOffer(offer);

      await provider.editsThatOffer();

      await provider.shouldSeeScore(score);
      await provider.shouldSeeBand(band);
    });
  }
});
