// Layer 2: example offers the specs talk about. Expected points come from the spec (scoring rules v1).
import type { OfferMetadata } from './driver';

export const DEFAULT_DATA_SOURCE = 'https://example.com/parking-occupancy-berlin/api';

/** A UUID-like title: earns no title points. */
export const MEANINGLESS_TITLE = 'f3b1c2d4-5e6f-4a7b-8c9d-0e1f2a3b4c5d';

export const EMPTY_OFFER: OfferMetadata = {
  title: '',
  assetId: '',
  description: '',
  keywords: [],
  language: 'English',
  dataCategory: '',
  dataSubcategory: '',
  transportMode: '',
  dataModel: '',
  endpointDocumentation: '',
  contentType: '',
  dataSampleUrls: [],
  referenceFileUrls: [],
  temporalCoverageStart: '',
  temporalCoverageEnd: '',
  dataUpdateFrequency: '',
  geoReferenceMethod: '',
  geoLocation: '',
  nutsLocations: [],
  sovereignLegalName: '',
  publisher: '',
  standardLicense: '',
  conditionsForUse: '',
  version: '',
};

/** Title (5 points) and a specific data category (3 points): 8 points. */
export const REQUIRED_ONLY_OFFER: OfferMetadata = {
  ...EMPTY_OFFER,
  title: 'Parking occupancy Berlin',
  dataCategory: 'Parking Service and Rest Area Information',
};

// Words for generated descriptions: none is a placeholder, and none repeats the default title.
const WORDS = [
  'sensors', 'report', 'free', 'spaces', 'in', 'every', 'car', 'park', 'across', 'the', 'city',
  'centre', 'with', 'updates', 'each', 'minute', 'including', 'capacity', 'and', 'opening', 'hours',
];

export type DescriptionStructure = 'a bulleted list' | 'headings' | 'a table';

/**
 * A description of exactly `count` words, as the spec counts them: Markdown markers
 * (# * _ ` > | [ ] ( ) -) are not words.
 */
export function descriptionOf(count: number, structure?: DescriptionStructure): string {
  const words = Array.from({ length: count }, (_, i) => WORDS[i % WORDS.length]);
  if (count === 0) return '';
  switch (structure) {
    case undefined:
      return `${words.join(' ')}.`;
    case 'headings':
      return `## ${words.slice(0, 2).join(' ')}\n\n${words.slice(2).join(' ')}`;
    case 'a bulleted list': {
      const lines: string[] = [];
      for (let i = 0; i < words.length; i += 5) lines.push(`- ${words.slice(i, i + 5).join(' ')}`);
      return lines.join('\n');
    }
    case 'a table':
      return `| ${words[0]} | ${words[1] ?? ''} |\n| --- | --- |\n\n${words.slice(2).join(' ')}`;
  }
}

/** Every piece of information, complete and valid: 100 points. */
export const COMPLETE_OFFER: OfferMetadata = {
  ...REQUIRED_ONLY_OFFER,
  description: descriptionOf(200, 'headings'),
  keywords: ['parking', 'occupancy', 'berlin'],
  dataSubcategory: 'Car Parking Availability',
  dataSampleUrls: ['https://example.com/parking-occupancy-berlin/sample.csv'],
  referenceFileUrls: ['https://example.com/parking-occupancy-berlin/schema.json'],
  endpointDocumentation: 'https://example.com/parking-occupancy-berlin/api-docs',
  contentType: 'application/json',
  dataModel: 'DATEX II',
  version: '1.0',
  temporalCoverageStart: '2025-01-01',
  temporalCoverageEnd: '2025-12-31',
  dataUpdateFrequency: 'Every 5 minutes',
  geoLocation: 'Berlin and vicinity',
  nutsLocations: ['DE300'],
  transportMode: 'Car',
  geoReferenceMethod: 'WGS84',
  standardLicense: 'https://creativecommons.org/licenses/by/4.0/',
  conditionsForUse: 'Please name the City of Berlin as the source.',
  publisher: 'https://www.berlin.de',
  sovereignLegalName: 'Land Berlin',
};

// Points per piece of information when complete (spec, scoring rules v1), largest first.
// Used to build an offer with an exact score; the subcategory needs the category.
const COMPOSABLE: { points: number; take: (keys: Set<string>) => Partial<OfferMetadata> | null }[] = [
  { points: 25, take: () => ({ description: COMPLETE_OFFER.description }) },
  { points: 8, take: () => ({ dataSampleUrls: COMPLETE_OFFER.dataSampleUrls }) },
  { points: 6, take: () => ({ standardLicense: COMPLETE_OFFER.standardLicense }) },
  { points: 6, take: () => ({ referenceFileUrls: COMPLETE_OFFER.referenceFileUrls }) },
  { points: 5, take: () => ({ keywords: COMPLETE_OFFER.keywords }) },
  { points: 5, take: () => ({ endpointDocumentation: COMPLETE_OFFER.endpointDocumentation }) },
  { points: 5, take: () => ({ contentType: COMPLETE_OFFER.contentType }) },
  {
    points: 5,
    take: () => ({
      temporalCoverageStart: COMPLETE_OFFER.temporalCoverageStart,
      temporalCoverageEnd: COMPLETE_OFFER.temporalCoverageEnd,
    }),
  },
  { points: 5, take: () => ({ title: COMPLETE_OFFER.title }) },
  { points: 4, take: () => ({ dataModel: COMPLETE_OFFER.dataModel }) },
  { points: 4, take: () => ({ dataUpdateFrequency: COMPLETE_OFFER.dataUpdateFrequency }) },
  { points: 3, take: () => ({ dataCategory: COMPLETE_OFFER.dataCategory }) },
  { points: 3, take: () => ({ geoLocation: COMPLETE_OFFER.geoLocation, nutsLocations: COMPLETE_OFFER.nutsLocations }) },
  { points: 3, take: () => ({ conditionsForUse: COMPLETE_OFFER.conditionsForUse }) },
  { points: 3, take: () => ({ publisher: COMPLETE_OFFER.publisher }) },
  { points: 3, take: () => ({ sovereignLegalName: COMPLETE_OFFER.sovereignLegalName }) },
  { points: 2, take: () => ({ version: COMPLETE_OFFER.version }) },
  { points: 2, take: () => ({ transportMode: COMPLETE_OFFER.transportMode }) },
  {
    points: 2,
    take: (keys) => (keys.has('dataCategory') ? { dataSubcategory: COMPLETE_OFFER.dataSubcategory } : null),
  },
  { points: 1, take: () => ({ geoReferenceMethod: COMPLETE_OFFER.geoReferenceMethod }) },
];

/** An offer that scores exactly `target` points. */
export function offerScoring(target: number): OfferMetadata {
  const offer: OfferMetadata = { ...EMPTY_OFFER, title: MEANINGLESS_TITLE };
  const keys = new Set<string>();
  let remaining = target;
  for (const { points, take } of COMPOSABLE) {
    if (points > remaining) continue;
    const part = take(keys);
    if (!part) continue;
    Object.assign(offer, part);
    Object.keys(part).forEach((key) => keys.add(key));
    remaining -= points;
  }
  if (remaining !== 0) throw new Error(`Cannot build an offer that scores exactly ${target} points`);
  return offer;
}

// Reference offers: the score-relevant shape of offers in the production MDS catalogue
// (read on 2026-11-06): which information is there, which is invalid, and how long and structured
// the description is. Texts and links are made up, so the providers' own wording is not copied.
export const REFERENCE_OFFERS = {
  // 70 = description 19 + keywords 5 + category 3 + title 5 + endpoint documentation 5 + content type 5
  //    + version 2 + temporal coverage 5 + update frequency 4 + geo location 3 + transport mode 2
  //    + license 6 + conditions 3 + publisher 3. Geo reference "N/A" and a URL as sovereign earn 0.
  'Korean flex parking usage transactions': {
    ...EMPTY_OFFER,
    title: 'Korean flex parking usage transactions',
    description: descriptionOf(55),
    keywords: ['parking usage history', 'parking fees', 'flexible parking', 'payments', 'subscriptions', 'discounts'],
    dataCategory: 'Parking Service and Rest Area Information',
    endpointDocumentation: 'https://example.com/flex-parking/docs',
    contentType: 'application/csv',
    version: '1.0',
    temporalCoverageStart: '2024-12-31',
    temporalCoverageEnd: '2025-12-30',
    dataUpdateFrequency: 'every month',
    geoLocation: '128.5342, 35.8342',
    geoReferenceMethod: 'N/A',
    transportMode: 'Car',
    standardLicense: 'https://example.com/flex-parking/license',
    conditionsForUse: 'https://example.com/flex-parking/terms',
    publisher: 'https://example.com/flex-parking',
    sovereignLegalName: 'https://example.com/flex-parking/owner',
  },
  // 64 = description 25 + keywords 5 + category 3 + title 5 + data sample 8 + reference file 6
  //    + content type 5 + geo reference method 1 + publisher 3 + sovereign 3.
  'Mobito Anonymized Aggregated Vehicle Probe Data': {
    ...EMPTY_OFFER,
    title: 'Mobito Anonymized Aggregated Vehicle Probe Data',
    description: descriptionOf(600, 'headings'),
    keywords: ['vehicle probe data', 'traffic', 'speed', 'aggregated'],
    dataCategory: 'Real Time Traffic Data',
    dataSampleUrls: ['https://example.com/probe-data/sample.json'],
    referenceFileUrls: ['https://example.com/probe-data/schema.json'],
    contentType: 'application/json',
    geoReferenceMethod: 'WGS84',
    publisher: 'https://example.com/probe-data',
    sovereignLegalName: 'Mobito Technology SRL',
  },
  // 56 = description 14 + keywords 5 + category 3 + title 5 + content type 5 + version 2
  //    + update frequency 4 + geo location 3 + license 6 + conditions 3 + publisher 3 + sovereign 3.
  'NEXTLOGIC DEMO Freight traffic (synthetic)': {
    ...EMPTY_OFFER,
    title: 'NEXTLOGIC DEMO Freight traffic (synthetic)',
    description: descriptionOf(35),
    keywords: ['freight', 'logistics', 'synthetic'],
    dataCategory: 'Freight and Logistics',
    contentType: 'application/json',
    version: '1.0',
    dataUpdateFrequency: 'Static demo snapshot, not updated',
    geoLocation: 'Czech Republic',
    standardLicense: 'https://example.com/freight-demo/license',
    conditionsForUse: 'Synthetic data for demonstrations only.',
    publisher: 'https://example.com/freight-demo',
    sovereignLegalName: 'Škoda Auto Vysoká škola z.ú.',
  },
  // 36 = description 19 + title 5 + content type 5 + version 2 + transport mode 2 + publisher 3.
  // No data category and no keywords.
  'BMW Accident': {
    ...EMPTY_OFFER,
    title: 'BMW Accident',
    description: descriptionOf(80),
    contentType: 'application/json',
    version: '1.0',
    transportMode: 'Car',
    publisher: 'https://example.com/accident-events',
  },
  // 8 = title 5 + category 3. No description.
  'Mobilithek Test Asset': {
    ...EMPTY_OFFER,
    title: 'Mobilithek Test Asset',
    dataCategory: 'Static Road Network Data',
  },
  // 6 = title 5 + category "Other" 1. The description only repeats the title.
  'IAV Logo 12': {
    ...EMPTY_OFFER,
    title: 'IAV Logo 12',
    description: 'IAV Logo 12 desc',
    dataCategory: 'Other',
  },
  // 1 = category "Other" 1. A random ID as title earns nothing.
  'eacde66e-5bab-4af4-ad79-0171a07b1a2f': {
    ...EMPTY_OFFER,
    title: 'eacde66e-5bab-4af4-ad79-0171a07b1a2f',
    dataCategory: 'Other',
  },
} satisfies Record<string, OfferMetadata>;

export type ReferenceOffer = keyof typeof REFERENCE_OFFERS;

let counter = 0;
/** A unique asset ID, so offers stored or published by different tests never clash. */
export function uniqueAssetId(title: string): string {
  const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40);
  counter += 1;
  return `${slug || 'offer'}-${Date.now().toString(36)}-${counter}`;
}
