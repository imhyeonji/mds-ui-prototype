@metadata-quality-score
Feature: Live metadata quality score while describing a data offer
  As a data provider
  I want to see my offer's metadata quality score while I describe the offer
  So that I can improve the description before the offer reaches the catalogue

  The score runs from 0 to 100 and follows the shared scoring rules v1, the same
  rules the catalogue uses. It measures how completely the offer is described,
  not the quality of the data itself.

  The required information is a title, a data category and where the data comes from.

  Rule: The score reflects the offer as it is described right now

    Scenario: An offer with only the required information starts with a low score
      Given a provider starts describing a new data offer
      When the provider gives the offer the title "Parking occupancy Berlin"
      And the provider sets the data category to "Parking Service and Rest Area Information"
      And the provider says where the data comes from
      Then the offer's score is 8 out of 100
      And the offer's band is "Basic"

    Scenario: The score follows every change before anything is saved
      Given a new data offer with only the required information
      When the provider adds a standard license
      Then the offer's score is 14 out of 100
      And the offer has not been saved

    Scenario: The score falls when information is removed
      Given a new data offer with only the required information
      And the offer has a standard license
      And the offer has a data sample
      When the provider removes the data sample
      Then the offer's score is 14 out of 100

  Rule: The band summarises the score

    Scenario Outline: A score of <score> is in the "<band>" band
      Given an offer that scores <score> points
      Then the offer's band is "<band>"

      Examples:
        | score | band      |
        | 0     | Basic     |
        | 24    | Basic     |
        | 25    | Fair      |
        | 49    | Fair      |
        | 50    | Good      |
        | 74    | Good      |
        | 75    | Excellent |
        | 100   | Excellent |

  Rule: A low score never stops the provider from publishing

    Scenario: Publishing an offer in the Basic band
      Given a new data offer with only the required information
      And the offer's band is "Basic"
      When the provider publishes the offer
      Then the data offer is published

  Rule: Offers that already exist show their score when the provider edits them

    Scenario: Editing an existing offer
      Given the provider's connector holds an offer with only the required information and a standard license
      When the provider edits that offer
      Then the offer's score is 14 out of 100
