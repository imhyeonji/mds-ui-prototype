// Layer 1: executable specification. Business behaviour only; every step goes through the domain DSL.
import { test } from '../../dsl';

test.describe('Live metadata quality score while describing a data offer', () => {
  // The score runs from 0 to 100 and follows the shared scoring rules v1, the same rules the
  // catalogue uses. It measures how completely the offer is described, not the data itself.
  // The required information is a title, a data category and where the data comes from.

  test.describe('The score reflects the offer as it is described right now', () => {
    test('an offer with only the required information starts with a low score', async ({ provider }) => {
      await provider.startsNewOffer();
      await provider.givesTitle('Parking occupancy Berlin');
      await provider.setsDataCategory('Parking Service and Rest Area Information');
      await provider.saysWhereTheDataComesFrom();

      await provider.shouldSeeScore(8);
      await provider.shouldSeeBand('Basic');
    });

    test('the score follows every change before anything is saved', async ({ provider }) => {
      await provider.startsNewOfferWithOnlyRequiredInformation();

      await provider.adds('a standard license');

      await provider.shouldSeeScore(14);
      await provider.shouldSeeOfferNotSavedYet();
    });

    test('the score falls when information is removed', async ({ provider }) => {
      await provider.startsNewOfferWithOnlyRequiredInformation();
      await provider.adds('a standard license');
      await provider.adds('a data sample');

      await provider.removes('a data sample');

      await provider.shouldSeeScore(14);
    });
  });

  test.describe('The band summarises the score', () => {
    const bands = [
      { score: 0, band: 'Basic' },
      { score: 24, band: 'Basic' },
      { score: 25, band: 'Fair' },
      { score: 49, band: 'Fair' },
      { score: 50, band: 'Good' },
      { score: 74, band: 'Good' },
      { score: 75, band: 'Excellent' },
      { score: 100, band: 'Excellent' },
    ] as const;

    for (const { score, band } of bands) {
      test(`a score of ${score} is in the ${band} band`, async ({ provider }) => {
        await provider.startsOfferThatScores(score);

        await provider.shouldSeeBand(band);
      });
    }
  });

  test.describe('A low score never stops the provider from publishing', () => {
    test('publishing an offer in the Basic band', async ({ provider }) => {
      await provider.startsNewOfferWithOnlyRequiredInformation();
      await provider.shouldSeeBand('Basic');

      await provider.publishesTheOffer();

      await provider.shouldSeeOfferPublished();
    });
  });

  test.describe('Offers that already exist show their score when the provider edits them', () => {
    test('editing an existing offer', async ({ provider }) => {
      await provider.hasExistingOfferWithRequiredInformationAnd('a standard license');

      await provider.editsThatOffer();

      await provider.shouldSeeScore(14);
    });
  });
});
