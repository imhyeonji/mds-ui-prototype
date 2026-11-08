// Layer 3: protocol driver that runs the DSL's steps through the functions the asset form uses.
// It keeps the form's state the way the create and edit pages do, changes it the way the form's
// fields do, and asks the same functions the pages ask: the metadata quality assessment, the form's
// validation, the mapper that builds what is sent to the connector, and the one that reads it back.
// The connector itself is replaced by an in-memory store that keeps the asset the form sends and
// gives it back as expanded JSON-LD, which is what the EDC client's `assets.get` hands the edit page.
import type { Asset, AssetInput } from "@think-it-labs/edc-connector-client";
import jsonld from "jsonld";

import { DATA_CATEGORY_SELECT_DATA, DATA_SUBCATEGORIES_DATA, GEO_REFERENCE_DATA } from "@/constants/data-category";
import { LANGUAGES } from "@/constants/languages";
import {
  AssetProperties,
  assetToAssetInput,
  defaultCreateAssetFormData,
  fromAssetForm,
  generateId,
  validateAdvancedInfo,
  validateDataAddress,
  validateGeneralInfo,
} from "@/utilities/asset";
import { assessMetadataQuality, type ScoreItem } from "@/domain/metadata-quality/assessment";
import {
  type AssetFormView,
  followSuggestion,
  initialAssetFormView,
  isReadyForInput,
} from "@/domain/metadata-quality/form-guidance";
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
  ASSET_LANGUAGE,
  ASSET_PUBLISHER,
  ASSET_STANDARD_LICENSE,
  ASSET_TITLE,
  ASSET_VERSION,
} from "@/jsonld/asset";
import { CONTEXT_EDC } from "@/jsonld/context";
import { isoToDateString } from "@/utilities/date";
import { isUrl } from "@/utilities/utilities";

import type {
  Band,
  NoPointsReason,
  OfferMetadata,
  OfferMetadataDriver,
  ScoreItem as DslScoreItem,
  Suggestion,
} from "../dsl/driver";

const ORGANIZATION_NAME = "Acceptance Test Organization";
const translate = (key: string) => key;

type Mode = "create" | "edit";

/** The connector, reduced to what the asset form relies on: store an asset, give it back. */
class InMemoryConnector {
  private readonly stored = new Map<string, Record<string, unknown>>();

  /** Keeps the asset the form sends, in the EDC management vocabulary. */
  create(asset: ReturnType<typeof fromAssetForm>) {
    this.stored.set(asset["@id"] as string, { ...asset, "@context": { "@vocab": CONTEXT_EDC.value } });
  }

  has(assetId: string) {
    return this.stored.has(assetId);
  }

  /** Gives the asset back as expanded JSON-LD, the form the EDC client's `assets.get` returns. */
  async get(assetId: string): Promise<Asset> {
    const body = this.stored.get(assetId);
    if (!body) throw new Error(`No asset "${assetId}" in the connector`);
    const [expanded] = await jsonld.expand(structuredClone(body) as jsonld.JsonLdDocument);
    return expanded as unknown as Asset;
  }
}

/** A link or code as the asset form's list fields keep it. */
type KeyValueInput = { input: { value: string }; valid: boolean; id: string };

const optionValue = (options: { text: string; value: string }[], label: string, what: string) => {
  if (!label) return "";
  const option = options.find(({ text }) => text === label);
  if (!option) throw new Error(`Unknown ${what} "${label}"`);
  return option.value;
};

const linkInputs = (values: string[]): KeyValueInput[] =>
  values.map((value, index) => ({ input: { value }, valid: isUrl(value), id: `link-${index}-${value}` }));

const codeInputs = (values: string[]): KeyValueInput[] =>
  values.map((value, index) => ({ input: { value }, valid: true, id: `code-${index}-${value}` }));

export class AssetFormDriver implements OfferMetadataDriver {
  private readonly connector = new InMemoryConnector();
  private asset: AssetInput = structuredClone(defaultCreateAssetFormData);
  private mode: Mode = "create";
  private view: AssetFormView = initialAssetFormView;
  private published = false;

  async startNewOffer() {
    this.asset = structuredClone(defaultCreateAssetFormData);
    this.mode = "create";
    this.view = initialAssetFormView;
    this.published = false;
  }

  async updateMetadata(changes: Partial<OfferMetadata>) {
    // Category first: choosing a category clears the subcategory, as the category field does.
    const { dataCategory, ...rest } = changes;
    if (dataCategory !== undefined) this.applyField("dataCategory", dataCategory);
    for (const [field, value] of Object.entries(rest) as [keyof OfferMetadata, OfferMetadata[keyof OfferMetadata]][]) {
      this.applyField(field, value);
    }
  }

  async setDataSource(url: string) {
    this.asset = { ...this.asset, dataAddress: { ...this.asset.dataAddress!, baseUrl: url } };
  }

  async createExistingOffer(metadata: OfferMetadata, dataSourceUrl: string) {
    await this.startNewOffer();
    await this.updateMetadata(metadata);
    await this.setDataSource(dataSourceUrl);
    this.connector.create(fromAssetForm(this.asset, ORGANIZATION_NAME));
    await this.startNewOffer();
  }

  async editExistingOffer(assetId: string) {
    // What the edit page does: get the asset from the connector and turn it into form data.
    this.asset = await assetToAssetInput(await this.connector.get(assetId));
    this.mode = "edit";
    this.view = initialAssetFormView;
    this.published = false;
  }

  async publish() {
    // What the create page checks before it lets the provider publish.
    const errors = {
      ...validateGeneralInfo(this.asset.properties, translate),
      ...validateAdvancedInfo(this.asset.properties),
      ...validateDataAddress(this.asset.dataAddress!, translate),
    };
    if (Object.keys(errors).length > 0) {
      throw new Error(`The form does not let the provider publish: ${Object.keys(errors).join(", ")}`);
    }
    this.connector.create(fromAssetForm(this.asset, ORGANIZATION_NAME));
    this.published = true;
  }

  async isCurrentOfferSaved() {
    return this.connector.has(this.asset.properties["@id"] as string);
  }

  async isCurrentOfferPublished() {
    return this.published;
  }

  async score() {
    return this.quality().score;
  }

  async band(): Promise<Band> {
    return this.quality().band;
  }

  async suggestions(): Promise<Suggestion[]> {
    return this.quality().suggestions.map(({ action, item, points }) => ({ action, item: toDsl(item), points }));
  }

  async noPointsReason(item: DslScoreItem): Promise<NoPointsReason | null> {
    const assessment = this.quality().items.find((candidate) => candidate.item === toForm(item));
    return assessment?.reason ?? null;
  }

  async followSuggestion(item: DslScoreItem) {
    const shown = this.quality().suggestions.some((suggestion) => suggestion.item === toForm(item));
    if (!shown) throw new Error(`There is no suggestion about ${item} to follow`);
    this.view = followSuggestion(this.view, toForm(item));
  }

  async isReadyForInput(item: DslScoreItem) {
    return isReadyForInput(this.view, toForm(item));
  }

  // ---- The form -----------------------------------------------------------------------------

  private quality() {
    return assessMetadataQuality(this.asset.properties);
  }

  private setProperties(properties: AssetProperties) {
    this.asset = { ...this.asset, properties, "@id": properties["@id"] };
  }

  /** Changes one field the way its input in the asset form does. */
  private applyField(field: keyof OfferMetadata, value: OfferMetadata[keyof OfferMetadata]) {
    const properties: AssetProperties = structuredClone(this.asset.properties);
    const textValue = value as string;
    const listValue = value as string[];

    switch (field) {
      case "title": {
        // On the create page the asset ID follows the title until the provider edits the ID.
        if (this.mode === "create") {
          const previousGeneratedId = generateId(properties[ASSET_TITLE] as string, properties[ASSET_VERSION] as string);
          if (previousGeneratedId === properties["@id"]) {
            properties["@id"] = generateId(textValue, properties[ASSET_VERSION] as string);
          }
        }
        properties[ASSET_TITLE] = textValue;
        break;
      }
      case "assetId":
        properties["@id"] = textValue;
        break;
      case "version": {
        if (this.mode === "create") {
          const previousGeneratedId = generateId(properties[ASSET_TITLE] as string, properties[ASSET_VERSION] as string);
          if (previousGeneratedId === properties["@id"]) {
            properties["@id"] = generateId(properties[ASSET_TITLE] as string, textValue);
          }
        }
        properties[ASSET_VERSION] = textValue;
        break;
      }
      case "description":
        properties[ASSET_DESCRIPTION] = textValue;
        break;
      case "keywords":
        properties[ASSET_KEYWORDS] = [...listValue];
        break;
      case "language":
        properties[ASSET_LANGUAGE] = optionValue(
          LANGUAGES.map(({ id, label }) => ({ value: id, text: label })),
          textValue,
          "language",
        );
        break;
      case "dataCategory":
        properties[ASSET_ADVANCED_INFO_MOBILITY_THEME] = {
          [ASSET_ADVANCED_INFO_DATA_CATEGORY]: optionValue(DATA_CATEGORY_SELECT_DATA, textValue, "data category"),
          [ASSET_ADVANCED_INFO_DATA_SUBCATEGORY]: "",
        };
        break;
      case "dataSubcategory": {
        const theme = properties[ASSET_ADVANCED_INFO_MOBILITY_THEME];
        const category = theme[ASSET_ADVANCED_INFO_DATA_CATEGORY] as string;
        theme[ASSET_ADVANCED_INFO_DATA_SUBCATEGORY] = optionValue(
          DATA_SUBCATEGORIES_DATA[category] ?? [],
          textValue,
          "data subcategory",
        );
        break;
      }
      case "transportMode":
        properties[ASSET_ADVANCED_INFO_TRANSPORT_MODE] = optionValue(GEO_REFERENCE_DATA, textValue, "transport mode");
        break;
      case "dataModel":
        properties[ASSET_ADVANCED_INFO_DATA_MODEL][ASSET_ADVANCED_INFO_DATA_MODEL_ID] = textValue;
        break;
      case "referenceFileUrls":
        properties[ASSET_ADVANCED_INFO_DATA_MODEL][ASSET_ADVANCED_INFO_DATA_MODEL_SCHEMA][
          ASSET_ADVANCED_INFO_REFERENCE_FILE_URLS
        ] = linkInputs(listValue);
        break;
      case "dataSampleUrls":
        properties[ASSET_ADVANCED_INFO_DATA_SAMPLE_URLS] = linkInputs(listValue);
        break;
      case "endpointDocumentation":
        properties[ASSET_ENDPOINT_DOCUMENTATION] = textValue;
        break;
      case "contentType":
        properties[ASSET_CONTENT_TYPE] = textValue;
        break;
      case "temporalCoverageStart":
        properties[ASSET_ADVANCED_INFO_TEMPORAL_COVERAGE][ASSET_ADVANCED_INFO_TEMPORAL_COVERAGE_START] =
          isoToDateString(textValue);
        break;
      case "temporalCoverageEnd":
        properties[ASSET_ADVANCED_INFO_TEMPORAL_COVERAGE][ASSET_ADVANCED_INFO_TEMPORAL_COVERAGE_END] =
          isoToDateString(textValue);
        break;
      case "dataUpdateFrequency":
        properties[ASSET_ADVANCED_INFO_DATA_UPDATE_FREQUENCY] = textValue;
        break;
      case "geoReferenceMethod":
        properties[ASSET_ADVANCED_INFO_GEO_REFERENCE_METHOD] = textValue;
        break;
      case "geoLocation":
        properties[ASSET_ADVANCED_INFO_GEO_LOCATION][ASSET_ADVANCED_INFO_GEO_LOCATION_LABEL] = textValue;
        break;
      case "nutsLocations":
        properties[ASSET_ADVANCED_INFO_GEO_LOCATION][ASSET_ADVANCED_INFO_GEO_LOCATION_NUTS] = codeInputs(listValue);
        break;
      case "sovereignLegalName":
        properties[ASSET_ADVANCED_INFO_SOVEREIGN_LEGAL_NAME] = textValue;
        break;
      case "publisher":
        properties[ASSET_PUBLISHER] = textValue;
        break;
      case "standardLicense":
        properties[ASSET_STANDARD_LICENSE] = textValue;
        break;
      case "conditionsForUse":
        properties[ASSET_ADVANCED_INFO_CONDITIONS_FOR_USE] = textValue;
        break;
      default: {
        const unknown: never = field;
        throw new Error(`The asset form has no field for "${unknown as string}"`);
      }
    }

    this.setProperties(properties);
  }
}

// The DSL and the form name the score items the same way; these keep the two in step.
const toForm = (item: DslScoreItem): ScoreItem => item;
const toDsl = (item: ScoreItem): DslScoreItem => item;
