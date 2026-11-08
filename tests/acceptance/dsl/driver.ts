// Layer 2 -> layer 3 contract: what the DSL needs from a protocol driver.
// A driver connects these calls to the real system (the scoring functions, or the form in the UI).
// Values are what the provider sees: labels such as "Car", not storage codes such as "CAR".

/** Everything a provider can say about a data offer. Empty text and empty lists mean "not given". */
export type OfferMetadata = {
  title: string;
  assetId: string;
  description: string;
  keywords: string[];
  /** Label, e.g. "English". */
  language: string;
  /** Label, e.g. "Parking Service and Rest Area Information". */
  dataCategory: string;
  /** Label, e.g. "Car Parking Availability". */
  dataSubcategory: string;
  /** Label, e.g. "Car". */
  transportMode: string;
  dataModel: string;
  endpointDocumentation: string;
  contentType: string;
  dataSampleUrls: string[];
  referenceFileUrls: string[];
  /** ISO date, YYYY-MM-DD. */
  temporalCoverageStart: string;
  /** ISO date, YYYY-MM-DD. */
  temporalCoverageEnd: string;
  dataUpdateFrequency: string;
  geoReferenceMethod: string;
  geoLocation: string;
  nutsLocations: string[];
  sovereignLegalName: string;
  publisher: string;
  standardLicense: string;
  conditionsForUse: string;
  version: string;
};

export type OfferField = keyof OfferMetadata;

/** The pieces of information the score is made of (scoring rules v1), in the order of the rules. */
export const SCORE_ITEMS = [
  'description',
  'keywords',
  'title',
  'dataCategory',
  'dataSubcategory',
  'dataSample',
  'referenceFile',
  'endpointDocumentation',
  'contentType',
  'dataModel',
  'version',
  'temporalCoverage',
  'dataUpdateFrequency',
  'geoLocation',
  'transportMode',
  'geoReferenceMethod',
  'standardLicense',
  'conditionsForUse',
  'publisher',
  'sovereignLegalName',
] as const;

export type ScoreItem = (typeof SCORE_ITEMS)[number];

export type Band = 'Basic' | 'Fair' | 'Good' | 'Excellent';

export type SuggestionAction = 'add' | 'improve' | 'fix';

export type Suggestion = { action: SuggestionAction; item: ScoreItem; points: number };

/** Why a piece of information earns no points (reason codes from the spec). */
export type NoPointsReason = 'missing' | 'placeholder' | 'invalid_url' | 'invalid_format' | 'repeats_title';

export interface OfferMetadataDriver {
  /** Start describing a new data offer. Nothing is saved yet. */
  startNewOffer(): Promise<void>;
  /** Change what the current offer says. Fields not given stay as they are. */
  updateMetadata(changes: Partial<OfferMetadata>): Promise<void>;
  /** Say where the current offer's data comes from. Required to publish; not scored. */
  setDataSource(url: string): Promise<void>;
  /** Store an offer in the provider's connector, as if it had been created earlier. */
  createExistingOffer(metadata: OfferMetadata, dataSourceUrl: string): Promise<void>;
  /** Start editing an offer stored with createExistingOffer. */
  editExistingOffer(assetId: string): Promise<void>;
  /** Publish the current offer as a data offer. */
  publish(): Promise<void>;

  isCurrentOfferSaved(): Promise<boolean>;
  isCurrentOfferPublished(): Promise<boolean>;

  score(): Promise<number>;
  band(): Promise<Band>;
  /** The suggestions shown to the provider, in the order shown. */
  suggestions(): Promise<Suggestion[]>;
  /** The reason given for an item that earns no points, or null when none is given. */
  noPointsReason(item: ScoreItem): Promise<NoPointsReason | null>;
  followSuggestion(item: ScoreItem): Promise<void>;
  /** Whether the provider can enter this information right now, without looking for it. */
  isReadyForInput(item: ScoreItem): Promise<boolean>;
}
