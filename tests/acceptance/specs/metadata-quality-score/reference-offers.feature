@metadata-quality-score
Feature: The provider sees the same score the catalogue will show
  For the same metadata, the score while describing an offer must equal the score
  in the catalogue. These reference offers come from the production MDS catalogue
  (read on 2026-11-06), and their expected scores come from the scoring rules v1.

  The catalogue did not return data subcategories, so the reference metadata has none.

  Scenario Outline: "<offer>" scores <score>
    Given the provider's connector holds an offer with the same metadata as the catalogue offer "<offer>"
    When the provider edits that offer
    Then the offer's score is <score> out of 100
    And the offer's band is "<band>"

    Examples:
      | offer                                           | score | band  |
      | Korean flex parking usage transactions          | 70    | Good  |
      | Mobito Anonymized Aggregated Vehicle Probe Data | 64    | Good  |
      | NEXTLOGIC DEMO Freight traffic (synthetic)      | 56    | Good  |
      | BMW Accident                                    | 36    | Fair  |
      | Mobilithek Test Asset                           | 8     | Basic |
      | IAV Logo 12                                     | 6     | Basic |
      | eacde66e-5bab-4af4-ad79-0171a07b1a2f            | 1     | Basic |
