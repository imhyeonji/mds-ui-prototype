// Layer 1: executable specification. Business behaviour only; every step goes through the domain DSL.
import { test } from '../../dsl';

// An offer with only the required information has the title "Parking occupancy Berlin" and the
// data category "Parking Service and Rest Area Information": 5 points for a meaningful title and
// 3 for a specific data category.
const REQUIRED_ONLY_SCORE = 8;

test.describe('How the metadata quality score is calculated (scoring rules v1)', () => {
  test.describe('Starting from an offer with only the required information', () => {
    test.beforeEach(async ({ provider }) => {
      await provider.startsNewOfferWithOnlyRequiredInformation();
    });

    test.describe('Each piece of information earns a fixed number of points', () => {
      const points = [
        // Understanding the data: 40 points in total
        { information: '3 keywords', points: 5 },
        { information: '2 keywords', points: 3 },
        { information: '1 keyword', points: 2 },
        { information: 'a data subcategory', points: 2 },
        // Using the data: 30 points in total
        { information: 'a data sample', points: 8 },
        { information: 'a reference file', points: 6 },
        { information: 'the endpoint documentation', points: 5 },
        { information: 'the content type', points: 5 },
        { information: 'the data model', points: 4 },
        { information: 'a version', points: 2 },
        // Context of the data: 15 points in total
        { information: 'a temporal coverage start and end date', points: 5 },
        { information: 'the data update frequency', points: 4 },
        { information: 'a geo location', points: 3 },
        { information: 'a NUTS location', points: 3 },
        { information: 'the transport mode', points: 2 },
        { information: 'the geo reference method', points: 1 },
        // Trusting the data: 15 points in total
        { information: 'a standard license', points: 6 },
        { information: 'the conditions for use', points: 3 },
        { information: 'the publisher', points: 3 },
        { information: "the sovereign's legal name", points: 3 },
      ] as const;

      for (const example of points) {
        test(`adding ${example.information} earns ${example.points} points`, async ({ provider }) => {
          await provider.adds(example.information);

          await provider.shouldSeeScore(REQUIRED_ONLY_SCORE + example.points);
        });
      }

      test('a geo location and a NUTS location together earn the geo points once', async ({ provider }) => {
        await provider.adds('a geo location');
        await provider.adds('a NUTS location');

        await provider.shouldSeeScore(REQUIRED_ONLY_SCORE + 3);
      });

      test('several data samples earn the data sample points once', async ({ provider }) => {
        await provider.adds('3 data samples');

        await provider.shouldSeeScore(REQUIRED_ONLY_SCORE + 8);
      });

      test('the language never earns points', async ({ provider }) => {
        await provider.changesLanguageTo('German');

        await provider.shouldSeeScore(REQUIRED_ONLY_SCORE);
      });
    });

    test.describe('The description earns points for its length', () => {
      const lengths = [
        { words: 0, points: 0 },
        { words: 1, points: 3 },
        { words: 4, points: 3 },
        { words: 5, points: 8 },
        { words: 19, points: 8 },
        { words: 20, points: 14 },
        { words: 49, points: 14 },
        { words: 50, points: 19 },
        { words: 149, points: 19 },
        { words: 150, points: 22 },
        { words: 400, points: 22 },
      ];

      for (const { words, points } of lengths) {
        test(`a description of ${words} words earns ${points} points`, async ({ provider }) => {
          await provider.writesDescriptionOf({ words });

          await provider.shouldSeeScore(REQUIRED_ONLY_SCORE + points);
        });
      }
    });

    test.describe('A description of 20 words or more earns 3 extra points for structure, up to 25', () => {
      const structured = [
        { words: 10, structure: 'a bulleted list', points: 8 },
        { words: 30, structure: 'a bulleted list', points: 17 },
        { words: 100, structure: 'headings', points: 22 },
        { words: 200, structure: 'a table', points: 25 },
      ] as const;

      for (const { words, structure, points } of structured) {
        test(`a ${words}-word description with ${structure} earns ${points} points`, async ({ provider }) => {
          await provider.writesDescriptionOf({ words, structure });

          await provider.shouldSeeScore(REQUIRED_ONLY_SCORE + points);
        });
      }
    });

    test.describe('A description that only repeats the title earns nothing', () => {
      const echoes = [
        { title: 'IAV Logo 12', description: 'IAV Logo 12 desc' },
        { title: 'Demo 1', description: 'Demo 1' },
        { title: 'Asset 3', description: 'Asset 3 description' },
      ];

      for (const { title, description } of echoes) {
        test(`"${description}" for the title "${title}" earns nothing`, async ({ provider }) => {
          await provider.changesTitleTo(title);

          await provider.writesDescription(description);

          await provider.shouldSeeScore(REQUIRED_ONLY_SCORE);
        });
      }

      test('a short description that adds something new still counts', async ({ provider }) => {
        await provider.changesTitleTo('HERE - DFRS Incidents');

        await provider.writesDescription('Incidents from HERE WeGo for DFRS.');

        await provider.shouldSeeScore(REQUIRED_ONLY_SCORE + 8);
      });
    });

    test.describe('Only a meaningful title earns the title points', () => {
      const titles = [
        { title: 'Parking occupancy Berlin', score: 8 },
        { title: 'eacde66e-5bab-4af4-ad79-0171a07b1a2f', score: 3 },
        { title: 'ddtr_1751011857@BPNL00000000Q7M3', score: 3 },
      ];

      for (const { title, score } of titles) {
        test(`the title "${title}" gives a score of ${score}`, async ({ provider }) => {
          await provider.changesTitleTo(title);

          await provider.shouldSeeScore(score);
        });
      }

      test('a title identical to the asset ID earns nothing', async ({ provider }) => {
        await provider.changesTitleTo('parking-occupancy-berlin');
        await provider.setsAssetId('parking-occupancy-berlin');

        await provider.shouldSeeScore(3);
      });
    });

    test.describe('A specific data category earns more than "Other"', () => {
      const categories = [
        { category: 'Parking Service and Rest Area Information', score: 8 },
        { category: 'Real Time Traffic Data', score: 8 },
        { category: 'Other', score: 6 },
      ];

      for (const { category, score } of categories) {
        test(`the data category "${category}" gives a score of ${score}`, async ({ provider }) => {
          await provider.setsDataCategory(category);

          await provider.shouldSeeScore(score);
        });
      }

      test('an offer without a data category yet earns no category points', async ({ provider }) => {
        await provider.clearsDataCategory();

        await provider.shouldSeeScore(5);
      });
    });

    test.describe('The score is rounded to the nearest whole number, halves up', () => {
      test('only a temporal coverage start date earns half the temporal coverage points', async ({ provider }) => {
        await provider.adds('a temporal coverage start date');

        // 8 + 2.5 = 10.5, shown as 11
        await provider.shouldSeeScore(11);
      });
    });
  });

  test.describe('A fully described offer scores 100', () => {
    test('every piece of information is complete and valid', async ({ provider }) => {
      await provider.startsNewOfferWithEverything();

      await provider.shouldSeeScore(100);
      await provider.shouldSeeBand('Excellent');
    });
  });
});
