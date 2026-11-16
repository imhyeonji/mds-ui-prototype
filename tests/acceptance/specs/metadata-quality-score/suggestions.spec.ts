// Layer 1: executable specification. Business behaviour only; every step goes through the domain DSL.
import { test } from '../../dsl';

// The provider sees at most three suggestions, ranked by the points each would add.
// A suggestion is to "add" missing information, "improve" information that earns only part of
// its points, or "fix" a value that earns nothing because it is not valid.

test.describe('Suggestions that raise the score the most', () => {
  test.describe('The three suggestions worth the most points are shown, highest first', () => {
    test('an offer with only the required information', async ({ provider }) => {
      await provider.startsNewOfferWithOnlyRequiredInformation();

      await provider.shouldSeeSuggestions([
        { action: 'add', information: 'description', points: 25 },
        { action: 'add', information: 'data sample', points: 8 },
        { action: 'add', information: 'reference file', points: 6 },
      ]);
    });

    test('an offer with a complete description and keywords', async ({ provider }) => {
      await provider.startsNewOfferWithOnlyRequiredInformation();
      await provider.writesDescriptionOf({ words: 200, structure: 'headings' });
      await provider.adds('3 keywords');

      await provider.shouldSeeSuggestions([
        { action: 'add', information: 'data sample', points: 8 },
        { action: 'add', information: 'reference file', points: 6 },
        { action: 'add', information: 'standard license', points: 6 },
      ]);
    });
  });

  test.describe('Suggestions worth the same points follow the order of the scoring rules', () => {
    // Order: description, keywords, title, data category, data subcategory,
    // data sample, reference file, endpoint documentation, content type, data model, version,
    // temporal coverage, data update frequency, geo location, transport mode, geo reference method,
    // standard license, conditions for use, publisher, sovereign's legal name.
    test('three pieces of information worth 5 points each', async ({ provider }) => {
      await provider.startsNewOfferWithOnlyRequiredInformation();
      await provider.writesDescriptionOf({ words: 200, structure: 'headings' });
      await provider.adds('3 keywords');
      await provider.adds('a data sample');
      await provider.adds('a reference file');
      await provider.adds('a standard license');

      await provider.shouldSeeSuggestions([
        { action: 'add', information: 'endpoint documentation', points: 5 },
        { action: 'add', information: 'content type', points: 5 },
        { action: 'add', information: 'temporal coverage', points: 5 },
      ]);
    });
  });

  test.describe('Information that earns only part of its points is suggested as an improvement', () => {
    test('a short description', async ({ provider }) => {
      await provider.startsNewOfferWithOnlyRequiredInformation();
      await provider.writesDescriptionOf({ words: 10 });

      await provider.shouldSeeSuggestions([
        { action: 'improve', information: 'description', points: 17 },
        { action: 'add', information: 'data sample', points: 8 },
        { action: 'add', information: 'reference file', points: 6 },
      ]);
    });
  });

  test.describe('Invalid values are suggested as fixes, and the provider is told why', () => {
    test('a standard license that is not a web address', async ({ provider }) => {
      await provider.startsNewOfferWithOnlyRequiredInformation();
      await provider.writesDescriptionOf({ words: 200, structure: 'headings' });
      await provider.adds('3 keywords');
      await provider.adds('a data sample');
      await provider.adds('a reference file');

      await provider.enters('the standard license', 'not a url');

      await provider.shouldSeeSuggestions([
        { action: 'fix', information: 'standard license', points: 6 },
        { action: 'add', information: 'endpoint documentation', points: 5 },
        { action: 'add', information: 'content type', points: 5 },
      ]);
      await provider.shouldBeToldItEarnsNoPoints('the standard license', { because: 'it is not a web address' });
    });

    test('an invalid value is explained even when it is not among the top three', async ({ provider }) => {
      await provider.startsNewOfferWithOnlyRequiredInformation();

      await provider.enters('the geo reference method', 'N/A');

      await provider.shouldBeToldItEarnsNoPoints('the geo reference method', { because: 'it is a placeholder' });
    });
  });

  test.describe('Suggestions follow every change', () => {
    test('a suggestion disappears once the provider acts on it', async ({ provider }) => {
      await provider.startsNewOfferWithOnlyRequiredInformation();

      await provider.adds('a data sample');

      await provider.shouldSeeSuggestions([
        { action: 'add', information: 'description', points: 25 },
        { action: 'add', information: 'reference file', points: 6 },
        { action: 'add', information: 'standard license', points: 6 },
      ]);
    });
  });

  test.describe('Fewer suggestions are shown when little is missing', () => {
    test('only the version is missing', async ({ provider }) => {
      await provider.startsNewOfferWithEverythingExcept('a version');

      await provider.shouldSeeScore(98);
      await provider.shouldSeeSuggestions([{ action: 'add', information: 'version', points: 2 }]);
    });

    test('nothing is missing', async ({ provider }) => {
      await provider.startsNewOfferWithEverything();

      await provider.shouldSeeNoSuggestions();
    });
  });

  test.describe('Following a suggestion takes the provider to that information', () => {
    test('following the suggestion to add a data sample', async ({ provider }) => {
      await provider.startsNewOfferWithOnlyRequiredInformation();

      await provider.followsSuggestion({ action: 'add', information: 'data sample' });

      // This holds even for information the provider has not opened yet.
      await provider.shouldBeAbleToEnterStraightAway('a data sample');
    });
  });

  test.describe('A suggestion never stops the provider from publishing', () => {
    test('publishing with suggestions left', async ({ provider }) => {
      await provider.startsNewOfferWithOnlyRequiredInformation();

      await provider.publishesTheOffer();

      await provider.shouldSeeOfferPublished();
    });
  });
});
