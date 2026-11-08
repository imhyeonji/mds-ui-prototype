// How the asset form leads the provider to a piece of information when they follow a suggestion.
import type { ScoreItem } from "@/domain/metadata-quality/assessment";

/** Where each piece of information is entered in the asset form, and whether it is an advanced field. */
export const SCORE_ITEM_FIELDS: Record<ScoreItem, { elementId: string; advanced: boolean }> = {
  description: { elementId: "properties-description", advanced: false },
  keywords: { elementId: "properties-keywords", advanced: false },
  title: { elementId: "properties-title", advanced: false },
  dataCategory: { elementId: "advanced-info-data-category", advanced: false },
  dataSubcategory: { elementId: "advanced-info-data-subcategory", advanced: false },
  dataSample: { elementId: "advanced-info-data-sample-urls", advanced: true },
  referenceFile: { elementId: "advanced-info-reference-file-urls", advanced: true },
  endpointDocumentation: { elementId: "properties-endpoint-documentation", advanced: true },
  contentType: { elementId: "properties-contenttype", advanced: true },
  dataModel: { elementId: "advanced-data-model", advanced: true },
  version: { elementId: "properties-version", advanced: true },
  temporalCoverage: { elementId: "advanced-info-temporal-coverage", advanced: true },
  dataUpdateFrequency: { elementId: "advanced-data-update-frequency", advanced: true },
  geoLocation: { elementId: "advanced-geo-location", advanced: true },
  transportMode: { elementId: "advanced-info-transport-mode", advanced: true },
  geoReferenceMethod: { elementId: "advanced-info-geo-reference-method", advanced: true },
  standardLicense: { elementId: "properties-standard-license", advanced: true },
  conditionsForUse: { elementId: "advanced-info-conditions-for-use", advanced: true },
  publisher: { elementId: "properties-publisher", advanced: true },
  sovereignLegalName: { elementId: "advanced-sovereign-legal-name", advanced: true },
};

/** What the asset form shows: the advanced fields or not, and which field the provider was taken to. */
export type AssetFormView = { showAdvancedFields: boolean; focusedItem: ScoreItem | null };

export const initialAssetFormView: AssetFormView = { showAdvancedFields: false, focusedItem: null };

export const toggleAdvancedFields = (view: AssetFormView): AssetFormView => ({
  showAdvancedFields: !view.showAdvancedFields,
  focusedItem: null,
});

/** Following a suggestion opens the advanced fields when needed and takes the provider to the field. */
export const followSuggestion = (view: AssetFormView, item: ScoreItem): AssetFormView => ({
  showAdvancedFields: view.showAdvancedFields || SCORE_ITEM_FIELDS[item].advanced,
  focusedItem: item,
});

/** The provider can enter the information right away: its field is shown and they were taken to it. */
export const isReadyForInput = (view: AssetFormView, item: ScoreItem): boolean =>
  view.focusedItem === item && (view.showAdvancedFields || !SCORE_ITEM_FIELDS[item].advanced);
