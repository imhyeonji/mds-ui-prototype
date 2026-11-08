@metadata-quality-score
Feature: Suggestions that raise the score the most
  As a data provider
  I want to know which information would raise my offer's score the most
  So that I spend my effort where it helps the users of my data most

  The provider sees at most three suggestions, ranked by the points each would add.
  A suggestion is one of:
    - add: the information is missing
    - improve: the information earns only part of its points
    - fix: the value earns nothing because it is not valid

  Rule: The three suggestions worth the most points are shown, highest first

    Scenario: An offer with only the required information
      Given a new data offer with only the required information
      Then the suggestions are:
        | rank | action | information    | points |
        | 1    | add    | description    | 25     |
        | 2    | add    | data sample    | 8      |
        | 3    | add    | reference file | 6      |

    Scenario: An offer with a complete description and keywords
      Given a new data offer with only the required information
      And the offer has a structured description of 200 words
      And the offer has 3 keywords
      Then the suggestions are:
        | rank | action | information      | points |
        | 1    | add    | data sample      | 8      |
        | 2    | add    | reference file   | 6      |
        | 3    | add    | standard license | 6      |

  Rule: Suggestions worth the same points follow the order of the scoring rules
    # Order: description, keywords, title, data category, data subcategory,
    # data sample, reference file, endpoint documentation, content type, data model, version,
    # temporal coverage, data update frequency, geo location, transport mode, geo reference method,
    # standard license, conditions for use, publisher, sovereign's legal name.

    Scenario: Three pieces of information worth 5 points each
      Given a new data offer with only the required information
      And the offer has a structured description of 200 words
      And the offer has 3 keywords
      And the offer has a data sample
      And the offer has a reference file
      And the offer has a standard license
      Then the suggestions are:
        | rank | action | information            | points |
        | 1    | add    | endpoint documentation | 5      |
        | 2    | add    | content type           | 5      |
        | 3    | add    | temporal coverage      | 5      |

  Rule: Information that earns only part of its points is suggested as an improvement

    Scenario: A short description
      Given a new data offer with only the required information
      And the offer has a description of 10 words
      Then the suggestions are:
        | rank | action  | information    | points |
        | 1    | improve | description    | 17     |
        | 2    | add     | data sample    | 8      |
        | 3    | add     | reference file | 6      |

  Rule: Invalid values are suggested as fixes, and the provider is told why

    Scenario: A standard license that is not a web address
      Given a new data offer with only the required information
      And the offer has a structured description of 200 words
      And the offer has 3 keywords
      And the offer has a data sample
      And the offer has a reference file
      When the provider enters "not a url" as the standard license
      Then the suggestions are:
        | rank | action | information            | points |
        | 1    | fix    | standard license       | 6      |
        | 2    | add    | endpoint documentation | 5      |
        | 3    | add    | content type           | 5      |
      And the provider is told the standard license earns no points because it is not a web address

    Scenario: An invalid value is explained even when it is not among the top three
      Given a new data offer with only the required information
      When the provider enters "N/A" as the geo reference method
      Then the provider is told the geo reference method earns no points because "N/A" is a placeholder

  Rule: Suggestions follow every change

    Scenario: A suggestion disappears once the provider acts on it
      Given a new data offer with only the required information
      When the provider adds a data sample
      Then the suggestions are:
        | rank | action | information      | points |
        | 1    | add    | description      | 25     |
        | 2    | add    | reference file   | 6      |
        | 3    | add    | standard license | 6      |

  Rule: Fewer suggestions are shown when little is missing

    Scenario: Only the version is missing
      Given a new data offer with every piece of information except a version
      Then the offer's score is 98 out of 100
      And the suggestions are:
        | rank | action | information | points |
        | 1    | add    | version     | 2      |

    Scenario: Nothing is missing
      Given a new data offer with every piece of information, complete and valid
      Then there are no suggestions

  Rule: Following a suggestion takes the provider to that information

    Scenario: Following the suggestion to add a data sample
      Given a new data offer with only the required information
      When the provider follows the suggestion to add a data sample
      Then the provider can enter a data sample straight away
      # This holds even for information the provider has not opened yet.

  Rule: A suggestion never stops the provider from publishing

    Scenario: Publishing with suggestions left
      Given a new data offer with only the required information
      When the provider publishes the offer
      Then the data offer is published
