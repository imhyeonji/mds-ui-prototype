// Layer 2: the words the specs use, and what each one means for an offer's metadata.
import type { NoPointsReason, OfferField, OfferMetadata, ScoreItem } from './driver';
import { COMPLETE_OFFER, EMPTY_OFFER } from './offers';

/** Information a provider can add, with the example value the DSL uses for it. */
export const ADDABLE = {
  '1 keyword': { item: 'keywords', changes: { keywords: ['parking'] } },
  '2 keywords': { item: 'keywords', changes: { keywords: ['parking', 'occupancy'] } },
  '3 keywords': { item: 'keywords', changes: { keywords: ['parking', 'occupancy', 'berlin'] } },
  // Valid for the default data category, "Parking Service and Rest Area Information".
  'a data subcategory': { item: 'dataSubcategory', changes: { dataSubcategory: 'Car Parking Availability' } },
  'a data sample': { item: 'dataSample', changes: { dataSampleUrls: COMPLETE_OFFER.dataSampleUrls } },
  '3 data samples': {
    item: 'dataSample',
    changes: {
      dataSampleUrls: [
        'https://example.com/parking-occupancy-berlin/sample-1.csv',
        'https://example.com/parking-occupancy-berlin/sample-2.csv',
        'https://example.com/parking-occupancy-berlin/sample-3.csv',
      ],
    },
  },
  'a reference file': { item: 'referenceFile', changes: { referenceFileUrls: COMPLETE_OFFER.referenceFileUrls } },
  'the endpoint documentation': {
    item: 'endpointDocumentation',
    changes: { endpointDocumentation: COMPLETE_OFFER.endpointDocumentation },
  },
  'the content type': { item: 'contentType', changes: { contentType: COMPLETE_OFFER.contentType } },
  'the data model': { item: 'dataModel', changes: { dataModel: COMPLETE_OFFER.dataModel } },
  'a version': { item: 'version', changes: { version: COMPLETE_OFFER.version } },
  'a temporal coverage start and end date': {
    item: 'temporalCoverage',
    changes: {
      temporalCoverageStart: COMPLETE_OFFER.temporalCoverageStart,
      temporalCoverageEnd: COMPLETE_OFFER.temporalCoverageEnd,
    },
  },
  'a temporal coverage start date': {
    item: 'temporalCoverage',
    changes: { temporalCoverageStart: COMPLETE_OFFER.temporalCoverageStart },
  },
  'the data update frequency': {
    item: 'dataUpdateFrequency',
    changes: { dataUpdateFrequency: COMPLETE_OFFER.dataUpdateFrequency },
  },
  'a geo location': { item: 'geoLocation', changes: { geoLocation: COMPLETE_OFFER.geoLocation } },
  'a NUTS location': { item: 'geoLocation', changes: { nutsLocations: COMPLETE_OFFER.nutsLocations } },
  'the transport mode': { item: 'transportMode', changes: { transportMode: COMPLETE_OFFER.transportMode } },
  'the geo reference method': {
    item: 'geoReferenceMethod',
    changes: { geoReferenceMethod: COMPLETE_OFFER.geoReferenceMethod },
  },
  'a standard license': { item: 'standardLicense', changes: { standardLicense: COMPLETE_OFFER.standardLicense } },
  'the conditions for use': {
    item: 'conditionsForUse',
    changes: { conditionsForUse: COMPLETE_OFFER.conditionsForUse },
  },
  'the publisher': { item: 'publisher', changes: { publisher: COMPLETE_OFFER.publisher } },
  "the sovereign's legal name": {
    item: 'sovereignLegalName',
    changes: { sovereignLegalName: COMPLETE_OFFER.sovereignLegalName },
  },
} satisfies Record<string, { item: ScoreItem; changes: Partial<OfferMetadata> }>;

export type AddableInformation = keyof typeof ADDABLE;

/** The same changes with every field emptied: what "removing" that information means. */
export function emptied(information: AddableInformation): Partial<OfferMetadata> {
  const fields = Object.keys(ADDABLE[information].changes) as OfferField[];
  return Object.fromEntries(fields.map((field) => [field, EMPTY_OFFER[field]])) as Partial<OfferMetadata>;
}

/** Information a provider can type a value into. */
export const ENTERABLE = {
  'a keyword': { field: 'keywords', item: 'keywords' },
  'a version': { field: 'version', item: 'version' },
  'a data sample': { field: 'dataSampleUrls', item: 'dataSample' },
  'a reference file': { field: 'referenceFileUrls', item: 'referenceFile' },
  'the endpoint documentation': { field: 'endpointDocumentation', item: 'endpointDocumentation' },
  'the content type': { field: 'contentType', item: 'contentType' },
  'the data model': { field: 'dataModel', item: 'dataModel' },
  'the data update frequency': { field: 'dataUpdateFrequency', item: 'dataUpdateFrequency' },
  'the geo reference method': { field: 'geoReferenceMethod', item: 'geoReferenceMethod' },
  'the standard license': { field: 'standardLicense', item: 'standardLicense' },
  'the conditions for use': { field: 'conditionsForUse', item: 'conditionsForUse' },
  'the publisher': { field: 'publisher', item: 'publisher' },
  "the sovereign's legal name": { field: 'sovereignLegalName', item: 'sovereignLegalName' },
} as const satisfies Record<string, { field: OfferField; item: ScoreItem }>;

export type EnterableInformation = keyof typeof ENTERABLE;

/** The value typed into a field; list fields get it as their only entry. */
export function entered(information: EnterableInformation, value: string): Partial<OfferMetadata> {
  const { field } = ENTERABLE[information];
  return { [field]: Array.isArray(EMPTY_OFFER[field]) ? [value] : value } as Partial<OfferMetadata>;
}

/** The names suggestions use for each piece of information. */
export const INFORMATION_NAMES = {
  description: 'description',
  keywords: 'keywords',
  title: 'title',
  'data category': 'dataCategory',
  'data subcategory': 'dataSubcategory',
  'data sample': 'dataSample',
  'reference file': 'referenceFile',
  'endpoint documentation': 'endpointDocumentation',
  'content type': 'contentType',
  'data model': 'dataModel',
  version: 'version',
  'temporal coverage': 'temporalCoverage',
  'data update frequency': 'dataUpdateFrequency',
  'geo location': 'geoLocation',
  'transport mode': 'transportMode',
  'geo reference method': 'geoReferenceMethod',
  'standard license': 'standardLicense',
  'conditions for use': 'conditionsForUse',
  publisher: 'publisher',
  "sovereign's legal name": 'sovereignLegalName',
} as const satisfies Record<string, ScoreItem>;

export type InformationName = keyof typeof INFORMATION_NAMES;

/** How the specs say why something earns no points. */
export const REASONS = {
  'it is missing': 'missing',
  'it is a placeholder': 'placeholder',
  'it is not a web address': 'invalid_url',
  'it is not in the expected format': 'invalid_format',
  'it only repeats the title': 'repeats_title',
} as const satisfies Record<string, NoPointsReason>;

export type Reason = keyof typeof REASONS;
