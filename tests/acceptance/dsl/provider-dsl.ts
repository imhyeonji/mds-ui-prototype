// Layer 2: the data provider, in the language of the specs. It turns each step into calls on a
// protocol driver (layer 3) and never knows whether that driver uses the UI or calls functions.
import { expect } from '@playwright/test';
import type { Band, OfferMetadata, OfferMetadataDriver, SuggestionAction } from './driver';
import {
  COMPLETE_OFFER,
  DEFAULT_DATA_SOURCE,
  REFERENCE_OFFERS,
  REQUIRED_ONLY_OFFER,
  descriptionOf,
  offerScoring,
  uniqueAssetId,
  type DescriptionStructure,
  type ReferenceOffer,
} from './offers';
import {
  ADDABLE,
  ENTERABLE,
  INFORMATION_NAMES,
  REASONS,
  emptied,
  entered,
  type AddableInformation,
  type EnterableInformation,
  type InformationName,
  type Reason,
} from './vocabulary';

export type ExpectedSuggestion = { action: SuggestionAction; information: InformationName; points: number };

export class ProviderDsl {
  private existingOfferAssetId: string | null = null;

  constructor(private readonly driver: OfferMetadataDriver) {}

  // ---- Starting an offer -------------------------------------------------------------------

  async startsNewOffer() {
    await this.driver.startNewOffer();
  }

  async startsNewOfferWithOnlyRequiredInformation() {
    await this.startsNewOfferWith(REQUIRED_ONLY_OFFER);
  }

  async startsNewOfferWithEverything() {
    await this.startsNewOfferWith(COMPLETE_OFFER);
  }

  async startsNewOfferWithEverythingExcept(information: AddableInformation) {
    await this.startsNewOfferWith({ ...COMPLETE_OFFER, ...emptied(information) });
  }

  async startsOfferThatScores(score: number) {
    await this.startsNewOfferWith(offerScoring(score));
  }

  async hasExistingOfferWithRequiredInformationAnd(information: AddableInformation) {
    await this.hasExistingOffer({ ...REQUIRED_ONLY_OFFER, ...ADDABLE[information].changes });
  }

  async hasExistingOfferLikeCatalogueOffer(offer: ReferenceOffer) {
    await this.hasExistingOffer(REFERENCE_OFFERS[offer]);
  }

  async editsThatOffer() {
    if (!this.existingOfferAssetId) throw new Error('No existing offer to edit: start with "hasExistingOffer…"');
    await this.driver.editExistingOffer(this.existingOfferAssetId);
  }

  // ---- Describing the offer ----------------------------------------------------------------

  async givesTitle(title: string) {
    await this.driver.updateMetadata({ title });
  }

  async changesTitleTo(title: string) {
    await this.driver.updateMetadata({ title });
  }

  async setsAssetId(assetId: string) {
    await this.driver.updateMetadata({ assetId });
  }

  async setsDataCategory(dataCategory: string) {
    await this.driver.updateMetadata({ dataCategory });
  }

  async clearsDataCategory() {
    await this.driver.updateMetadata({ dataCategory: '', dataSubcategory: '' });
  }

  async changesLanguageTo(language: string) {
    await this.driver.updateMetadata({ language });
  }

  async saysWhereTheDataComesFrom() {
    await this.driver.setDataSource(DEFAULT_DATA_SOURCE);
  }

  async adds(information: AddableInformation) {
    await this.driver.updateMetadata(ADDABLE[information].changes);
  }

  async addsDataSamples(...urls: string[]) {
    await this.driver.updateMetadata({ dataSampleUrls: urls });
  }

  async removes(information: AddableInformation) {
    await this.driver.updateMetadata(emptied(information));
  }

  async enters(information: EnterableInformation, value: string) {
    await this.driver.updateMetadata(entered(information, value));
  }

  async writesDescriptionOf({ words, structure }: { words: number; structure?: DescriptionStructure }) {
    await this.driver.updateMetadata({ description: descriptionOf(words, structure) });
  }

  async writesDescription(description: string) {
    await this.driver.updateMetadata({ description });
  }

  async followsSuggestion({ information }: { action: SuggestionAction; information: InformationName }) {
    await this.driver.followSuggestion(INFORMATION_NAMES[information]);
  }

  async publishesTheOffer() {
    // A fresh asset ID per publish keeps repeated runs from clashing in the connector.
    await this.driver.updateMetadata({ assetId: uniqueAssetId('data offer') });
    await this.driver.publish();
  }

  // ---- What the provider should see ---------------------------------------------------------

  async shouldSeeScore(score: number) {
    await expect.poll(() => this.driver.score(), { message: 'metadata quality score' }).toBe(score);
  }

  async shouldSeeBand(band: Band) {
    await expect.poll(() => this.driver.band(), { message: 'metadata quality band' }).toBe(band);
  }

  async shouldSeeSuggestions(expected: ExpectedSuggestion[]) {
    const suggestions = expected.map(({ action, information, points }) => ({
      action,
      item: INFORMATION_NAMES[information],
      points,
    }));
    await expect.poll(() => this.driver.suggestions(), { message: 'suggestions' }).toEqual(suggestions);
  }

  async shouldSeeNoSuggestions() {
    await expect.poll(() => this.driver.suggestions(), { message: 'suggestions' }).toEqual([]);
  }

  async shouldBeToldItEarnsNoPoints(information: EnterableInformation, { because }: { because: Reason }) {
    await expect
      .poll(() => this.driver.noPointsReason(ENTERABLE[information].item), { message: `why ${information} earns nothing` })
      .toBe(REASONS[because]);
  }

  async shouldSeeOfferNotSavedYet() {
    expect(await this.driver.isCurrentOfferSaved(), 'offer saved').toBe(false);
  }

  async shouldSeeOfferPublished() {
    await expect.poll(() => this.driver.isCurrentOfferPublished(), { message: 'offer published' }).toBe(true);
  }

  async shouldBeAbleToEnterStraightAway(information: AddableInformation) {
    expect(await this.driver.isReadyForInput(ADDABLE[information].item), `ready to enter ${information}`).toBe(true);
  }

  // ---- Helpers --------------------------------------------------------------------------------

  private async startsNewOfferWith(metadata: OfferMetadata) {
    await this.driver.startNewOffer();
    await this.driver.updateMetadata(metadata);
    await this.driver.setDataSource(DEFAULT_DATA_SOURCE);
  }

  private async hasExistingOffer(metadata: OfferMetadata) {
    const assetId = uniqueAssetId(metadata.title);
    await this.driver.createExistingOffer({ ...metadata, assetId }, DEFAULT_DATA_SOURCE);
    this.existingOfferAssetId = assetId;
  }
}
