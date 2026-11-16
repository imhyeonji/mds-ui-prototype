// Metadata quality score, scoring rules v1: how completely a data offer is described (0-100).
// It works on the asset form's properties so the form can show it live; the catalogue applies the
// same rules. The score never decides whether an offer can be published.
import dayjs from "dayjs";
import customParseFormat from "dayjs/plugin/customParseFormat.js";

import type { AssetProperties } from "@/utilities/asset";
import {
  ASSET_ADVANCED_INFO_CONDITIONS_FOR_USE,
  ASSET_ADVANCED_INFO_DATA_CATEGORY,
  ASSET_ADVANCED_INFO_DATA_MODEL,
  ASSET_ADVANCED_INFO_DATA_MODEL_ID,
  ASSET_ADVANCED_INFO_DATA_MODEL_SCHEMA,
  ASSET_ADVANCED_INFO_DATA_SAMPLE_URLS,
  ASSET_ADVANCED_INFO_DATA_SUBCATEGORY,
  ASSET_ADVANCED_INFO_DATA_UPDATE_FREQUENCY,
  ASSET_ADVANCED_INFO_GEO_LOCATION,
  ASSET_ADVANCED_INFO_GEO_LOCATION_LABEL,
  ASSET_ADVANCED_INFO_GEO_LOCATION_NUTS,
  ASSET_ADVANCED_INFO_GEO_REFERENCE_METHOD,
  ASSET_ADVANCED_INFO_MOBILITY_THEME,
  ASSET_ADVANCED_INFO_REFERENCE_FILE_URLS,
  ASSET_ADVANCED_INFO_SOVEREIGN_LEGAL_NAME,
  ASSET_ADVANCED_INFO_TEMPORAL_COVERAGE,
  ASSET_ADVANCED_INFO_TEMPORAL_COVERAGE_END,
  ASSET_ADVANCED_INFO_TEMPORAL_COVERAGE_START,
  ASSET_ADVANCED_INFO_TRANSPORT_MODE,
  ASSET_CONTENT_TYPE,
  ASSET_DESCRIPTION,
  ASSET_ENDPOINT_DOCUMENTATION,
  ASSET_KEYWORDS,
  ASSET_PUBLISHER,
  ASSET_STANDARD_LICENSE,
  ASSET_TITLE,
  ASSET_VERSION,
} from "@/jsonld/asset";
import { DATE_FORMAT } from "@/utilities/date";
import { isUrl } from "@/utilities/utilities";

dayjs.extend(customParseFormat);

export const SCORING_RULES_VERSION = 1;

/** The pieces of information the score is made of, in the order of the scoring rules. */
export const SCORE_ITEMS = [
  "description",
  "keywords",
  "title",
  "dataCategory",
  "dataSubcategory",
  "dataSample",
  "referenceFile",
  "endpointDocumentation",
  "contentType",
  "dataModel",
  "version",
  "temporalCoverage",
  "dataUpdateFrequency",
  "geoLocation",
  "transportMode",
  "geoReferenceMethod",
  "standardLicense",
  "conditionsForUse",
  "publisher",
  "sovereignLegalName",
] as const;

export type ScoreItem = (typeof SCORE_ITEMS)[number];

export type MetadataQualityBand = "Basic" | "Fair" | "Good" | "Excellent";

/** Why an item earns no points. Only the last four are something to fix. */
export type NoPointsReason = "missing" | "placeholder" | "invalid_url" | "invalid_format" | "repeats_title";

export type ItemAssessment = {
  item: ScoreItem;
  points: number;
  max: number;
  /** Set when the item earns no points. */
  reason: NoPointsReason | null;
};

export type SuggestionAction = "add" | "improve" | "fix";

export type MetadataQualitySuggestion = { action: SuggestionAction; item: ScoreItem; points: number };

export type MetadataQuality = {
  score: number;
  band: MetadataQualityBand;
  items: ItemAssessment[];
  /** At most three, the ones worth the most points first. */
  suggestions: MetadataQualitySuggestion[];
};

const MAX_SUGGESTIONS = 3;

const PLACEHOLDER = /^(n\/?a|none|null|tbd|to be defined|todo|test|xxx|-+|\.|unknown|lorem.*)$/i;
const DATA_FORMAT =
  /^(application|text|image|audio|video)\/[\w.+-]+|^(json|geojson|csv|xml|xlsx?|parquet|gtfs|netex|datex ?ii|siri|protobuf|zip)$/i;
const RANDOM_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-/i;
const STRUCTURE = /(^|\n)\s*(#{1,4} |[-*] |\d+\. )|\|.+\|/;
const FIXABLE: NoPointsReason[] = ["placeholder", "invalid_url", "invalid_format", "repeats_title"];

// ---- Reading form values ----------------------------------------------------------------------

const text = (value: unknown): string => (typeof value === "string" ? value.trim() : "");

/** Values of a list field: plain strings, or the key-value inputs the form uses for links and codes. */
const listValues = (value: unknown): string[] => {
  const entries = Array.isArray(value) ? value : [value];
  return entries
    .map((entry) => {
      if (typeof entry === "string") return entry;
      const input = entry?.input;
      return input?.value ?? input?.input?.value ?? entry?.value;
    })
    .map(text)
    .filter(Boolean);
};

const isPlaceholder = (value: string) => PLACEHOLDER.test(value);

/** Words as the rules count them: Markdown markers are not words. */
const words = (value: string) =>
  value
    .replace(/[#*_`>|[\]()-]/g, " ")
    .split(/\s+/)
    .filter(Boolean);

const isDate = (value: string) =>
  dayjs(value, DATE_FORMAT, true).isValid() || (/^\d{4}-\d{2}-\d{2}/.test(value) && dayjs(value).isValid());

// ---- Scoring each item ------------------------------------------------------------------------

type Outcome = { points: number; reason: NoPointsReason | null };

const earned = (points: number): Outcome => ({ points, reason: null });
const none = (reason: NoPointsReason): Outcome => ({ points: 0, reason });

/** A free-text item: full points unless empty or a placeholder. */
const textItem = (value: string, points: number): Outcome => {
  if (!value) return none("missing");
  return isPlaceholder(value) ? none("placeholder") : earned(points);
};

/** A link item, or a list of links: full points when at least one is a web address. */
const linkItem = (values: string[], points: number): Outcome => {
  if (values.length === 0) return none("missing");
  if (values.some((value) => isUrl(value))) return earned(points);
  return values.every(isPlaceholder) ? none("placeholder") : none("invalid_url");
};

const descriptionPoints = (wordCount: number) => {
  if (wordCount === 0) return 0;
  if (wordCount < 5) return 3;
  if (wordCount < 20) return 8;
  if (wordCount < 50) return 14;
  if (wordCount < 150) return 19;
  return 22;
};

const scoreDescription = (description: string, title: string): Outcome => {
  if (!description) return none("missing");
  if (isPlaceholder(description)) return none("placeholder");
  // A description that only repeats the title says nothing new.
  const lowerDescription = description.toLowerCase();
  const lowerTitle = title.toLowerCase();
  if (lowerTitle && lowerDescription.includes(lowerTitle)) {
    const rest = lowerDescription.replace(lowerTitle, "").replace(/\b(desc|description)\b/g, "");
    if (words(rest).length < 3) return none("repeats_title");
  }
  const wordCount = words(description).length;
  if (wordCount === 0) return none("missing");
  const structureBonus = wordCount >= 20 && STRUCTURE.test(description) ? 3 : 0;
  return earned(Math.min(descriptionPoints(wordCount) + structureBonus, 25));
};

const scoreKeywords = (raw: string[]): Outcome => {
  const keywords = raw.filter((keyword) => !isPlaceholder(keyword));
  if (keywords.length >= 3) return earned(5);
  if (keywords.length === 2) return earned(3);
  if (keywords.length === 1) return earned(2);
  return raw.length > 0 ? none("placeholder") : none("missing");
};

const scoreTitle = (title: string, assetId: string): Outcome => {
  if (!title) return none("missing");
  if (isPlaceholder(title)) return none("placeholder");
  if (RANDOM_ID.test(title) || title === assetId || title.includes("@BPNL")) return none("invalid_format");
  return earned(5);
};

const scoreDataCategory = (category: string): Outcome => {
  if (!category) return none("missing");
  if (isPlaceholder(category)) return none("placeholder");
  return earned(category.toUpperCase() === "OTHER" ? 1 : 3);
};

const scoreContentType = (contentType: string): Outcome => {
  if (!contentType) return none("missing");
  if (isPlaceholder(contentType)) return none("placeholder");
  return DATA_FORMAT.test(contentType) || isUrl(contentType) ? earned(5) : none("invalid_format");
};

const scoreTemporalCoverage = (start: string, end: string): Outcome => {
  if (!start && !end) return none("missing");
  const points = (start && isDate(start) ? 2.5 : 0) + (end && isDate(end) ? 2.5 : 0);
  return points > 0 ? earned(points) : none("invalid_format");
};

const scoreGeoLocation = (label: string, nuts: string[]): Outcome => {
  const values = [label, ...nuts].filter(Boolean);
  if (values.length === 0) return none("missing");
  return values.some((value) => !isPlaceholder(value)) ? earned(3) : none("placeholder");
};

const scoreSovereign = (legalName: string): Outcome => {
  const outcome = textItem(legalName, 3);
  return outcome.points > 0 && isUrl(legalName) ? none("invalid_format") : outcome;
};

const MAX_POINTS: Record<ScoreItem, number> = {
  description: 25,
  keywords: 5,
  title: 5,
  dataCategory: 3,
  dataSubcategory: 2,
  dataSample: 8,
  referenceFile: 6,
  endpointDocumentation: 5,
  contentType: 5,
  dataModel: 4,
  version: 2,
  temporalCoverage: 5,
  dataUpdateFrequency: 4,
  geoLocation: 3,
  transportMode: 2,
  geoReferenceMethod: 1,
  standardLicense: 6,
  conditionsForUse: 3,
  publisher: 3,
  sovereignLegalName: 3,
};

const scoreItems = (properties: AssetProperties): Record<ScoreItem, Outcome> => {
  const mobilityTheme = properties[ASSET_ADVANCED_INFO_MOBILITY_THEME] ?? {};
  const dataModel = properties[ASSET_ADVANCED_INFO_DATA_MODEL] ?? {};
  const schema = dataModel[ASSET_ADVANCED_INFO_DATA_MODEL_SCHEMA] ?? {};
  const temporalCoverage = properties[ASSET_ADVANCED_INFO_TEMPORAL_COVERAGE] ?? {};
  const geoLocation = properties[ASSET_ADVANCED_INFO_GEO_LOCATION] ?? {};
  const title = text(properties[ASSET_TITLE]);

  return {
    description: scoreDescription(text(properties[ASSET_DESCRIPTION]), title),
    keywords: scoreKeywords(listValues(properties[ASSET_KEYWORDS])),
    title: scoreTitle(title, text(properties["@id"])),
    dataCategory: scoreDataCategory(text(mobilityTheme[ASSET_ADVANCED_INFO_DATA_CATEGORY])),
    dataSubcategory: textItem(text(mobilityTheme[ASSET_ADVANCED_INFO_DATA_SUBCATEGORY]), 2),
    dataSample: linkItem(listValues(properties[ASSET_ADVANCED_INFO_DATA_SAMPLE_URLS]), 8),
    referenceFile: linkItem(listValues(schema[ASSET_ADVANCED_INFO_REFERENCE_FILE_URLS]), 6),
    endpointDocumentation: linkItem(listValues(properties[ASSET_ENDPOINT_DOCUMENTATION]), 5),
    contentType: scoreContentType(text(properties[ASSET_CONTENT_TYPE])),
    dataModel: textItem(text(dataModel[ASSET_ADVANCED_INFO_DATA_MODEL_ID]), 4),
    version: textItem(text(properties[ASSET_VERSION]), 2),
    temporalCoverage: scoreTemporalCoverage(
      text(temporalCoverage[ASSET_ADVANCED_INFO_TEMPORAL_COVERAGE_START]),
      text(temporalCoverage[ASSET_ADVANCED_INFO_TEMPORAL_COVERAGE_END]),
    ),
    dataUpdateFrequency: textItem(text(properties[ASSET_ADVANCED_INFO_DATA_UPDATE_FREQUENCY]), 4),
    geoLocation: scoreGeoLocation(
      text(geoLocation[ASSET_ADVANCED_INFO_GEO_LOCATION_LABEL]),
      listValues(geoLocation[ASSET_ADVANCED_INFO_GEO_LOCATION_NUTS]),
    ),
    transportMode: textItem(text(properties[ASSET_ADVANCED_INFO_TRANSPORT_MODE]), 2),
    geoReferenceMethod: textItem(text(properties[ASSET_ADVANCED_INFO_GEO_REFERENCE_METHOD]), 1),
    standardLicense: linkItem(listValues(properties[ASSET_STANDARD_LICENSE]), 6),
    conditionsForUse: textItem(text(properties[ASSET_ADVANCED_INFO_CONDITIONS_FOR_USE]), 3),
    publisher: linkItem(listValues(properties[ASSET_PUBLISHER]), 3),
    sovereignLegalName: scoreSovereign(text(properties[ASSET_ADVANCED_INFO_SOVEREIGN_LEGAL_NAME])),
  };
};

// ---- The assessment ---------------------------------------------------------------------------

export const bandFor = (score: number): MetadataQualityBand => {
  if (score >= 75) return "Excellent";
  if (score >= 50) return "Good";
  if (score >= 25) return "Fair";
  return "Basic";
};

const actionFor = ({ points, reason }: ItemAssessment): SuggestionAction => {
  if (points > 0) return "improve";
  return reason && FIXABLE.includes(reason) ? "fix" : "add";
};

/** The items that would add the most points, ties in the order of the scoring rules. */
const suggestionsFor = (items: ItemAssessment[]): MetadataQualitySuggestion[] =>
  items
    .filter(({ points, max }) => points < max)
    .map((assessment) => ({
      action: actionFor(assessment),
      item: assessment.item,
      points: assessment.max - assessment.points,
    }))
    .sort((a, b) => b.points - a.points || SCORE_ITEMS.indexOf(a.item) - SCORE_ITEMS.indexOf(b.item))
    .slice(0, MAX_SUGGESTIONS);

export const assessMetadataQuality = (properties: AssetProperties): MetadataQuality => {
  const outcomes = scoreItems(properties);
  const items = SCORE_ITEMS.map((item) => ({ item, max: MAX_POINTS[item], ...outcomes[item] }));
  const score = Math.round(items.reduce((total, { points }) => total + points, 0));
  return { score, band: bandFor(score), items, suggestions: suggestionsFor(items) };
};

/** Items that earn nothing because of what was entered, with the reason to show the provider. */
export const itemsToFix = (quality: MetadataQuality): ItemAssessment[] =>
  quality.items.filter(({ reason }) => reason !== null && FIXABLE.includes(reason));
