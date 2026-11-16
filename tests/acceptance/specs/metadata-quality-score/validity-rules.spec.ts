// Layer 1: executable specification. Business behaviour only; every step goes through the domain DSL.
import { test } from '../../dsl';

// The form accepts any text in most fields, so the score checks each value itself.
// Empty, placeholder and misplaced values earn no points.
const REQUIRED_ONLY_SCORE = 8;

test.describe('Only valid information earns points', () => {
  test.beforeEach(async ({ provider }) => {
    await provider.startsNewOfferWithOnlyRequiredInformation();
  });

  test.describe('Placeholders earn nothing, whatever their capitalisation', () => {
    const placeholders = [
      { information: 'the geo reference method', value: 'N/A' },
      { information: 'the geo reference method', value: 'n/a' },
      { information: 'the data model', value: 'TBD' },
      { information: "the sovereign's legal name", value: 'to be defined' },
      { information: 'the data update frequency', value: '-' },
      { information: 'the conditions for use', value: 'test' },
      { information: 'a version', value: 'none' },
      { information: 'a keyword', value: 'unknown' },
      { information: 'the data model', value: '' },
    ] as const;

    for (const { information, value } of placeholders) {
      test(`"${value}" as ${information} earns nothing`, async ({ provider }) => {
        await provider.enters(information, value);

        await provider.shouldSeeScore(REQUIRED_ONLY_SCORE);
      });
    }
  });

  test.describe('Links must be web addresses starting with http:// or https://', () => {
    const links = [
      // Valid web addresses
      { information: 'the standard license', value: 'https://creativecommons.org/licenses/by/4.0/', points: 6 },
      { information: 'the standard license', value: 'http://opendatacommons.org/licenses/odbl/', points: 6 },
      { information: 'the publisher', value: 'https://www.bmwgroup.com', points: 3 },
      { information: 'the endpoint documentation', value: 'https://example.com/api/docs', points: 5 },
      { information: 'a data sample', value: 'https://example.com/sample.csv', points: 8 },
      { information: 'a reference file', value: 'https://example.com/schema.json', points: 6 },
      // Not web addresses
      { information: 'the standard license', value: 'not a url', points: 0 },
      { information: 'the standard license', value: 'ftp://example.com/license', points: 0 },
      { information: 'the publisher', value: 'BMW AG', points: 0 },
      { information: 'the endpoint documentation', value: 'www.example.com/docs', points: 0 },
      { information: 'a data sample', value: 'sample.csv', points: 0 },
      { information: 'a reference file', value: 'schema.json', points: 0 },
    ] as const;

    for (const { information, value, points } of links) {
      test(`"${value}" as ${information} earns ${points} points`, async ({ provider }) => {
        await provider.enters(information, value);

        await provider.shouldSeeScore(REQUIRED_ONLY_SCORE + points);
      });
    }

    test('one valid data sample among invalid ones is enough', async ({ provider }) => {
      await provider.addsDataSamples('sample.csv', 'https://example.com/sample.csv');

      await provider.shouldSeeScore(REQUIRED_ONLY_SCORE + 8);
    });
  });

  test.describe('The content type must name a data format', () => {
    const contentTypes = [
      { value: 'application/json', points: 5 },
      { value: 'text/csv', points: 5 },
      { value: 'GeoJSON', points: 5 },
      { value: 'DATEX II', points: 5 },
      { value: 'https://www.iana.org/assignments/media-types/application/json', points: 5 },
      { value: 'cluj bike', points: 0 },
      { value: 'Air Quality in Cluj-Napoca', points: 0 },
    ];

    for (const { value, points } of contentTypes) {
      test(`"${value}" as the content type earns ${points} points`, async ({ provider }) => {
        await provider.enters('the content type', value);

        await provider.shouldSeeScore(REQUIRED_ONLY_SCORE + points);
      });
    }
  });

  test.describe('The sovereign is a legal name, not a web address', () => {
    const sovereigns = [
      { value: 'BMW AG', points: 3 },
      { value: 'https://www.bmwgroup.com', points: 0 },
    ];

    for (const { value, points } of sovereigns) {
      test(`"${value}" as the sovereign's legal name earns ${points} points`, async ({ provider }) => {
        await provider.enters("the sovereign's legal name", value);

        await provider.shouldSeeScore(REQUIRED_ONLY_SCORE + points);
      });
    }
  });
});
