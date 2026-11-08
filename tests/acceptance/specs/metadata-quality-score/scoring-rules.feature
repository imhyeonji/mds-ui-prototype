@metadata-quality-score
Feature: How the metadata quality score is calculated
  The score is the sum of the points each piece of information earns, 100 at most.
  These are the shared scoring rules v1, used by both the catalogue and the provider.

  An offer with only the required information has the title "Parking occupancy Berlin"
  and the data category "Parking Service and Rest Area Information". It scores 8 points:
  5 for a meaningful title and 3 for a specific data category.

  Background:
    Given a new data offer with only the required information

  Rule: Each piece of information earns a fixed number of points

    Scenario Outline: Adding <information> earns <points> points
      When the provider adds <information>
      Then the offer's score rises by <points> points

      Examples: Understanding the data (40 points in total)
        | information        | points |
        | 3 keywords         | 5      |
        | 2 keywords         | 3      |
        | 1 keyword          | 2      |
        | a data subcategory | 2      |

      Examples: Using the data (30 points in total)
        | information                | points |
        | a data sample              | 8      |
        | a reference file           | 6      |
        | the endpoint documentation | 5      |
        | the content type           | 5      |
        | the data model             | 4      |
        | a version                  | 2      |

      Examples: Context of the data (15 points in total)
        | information                             | points |
        | a temporal coverage start and end date  | 5      |
        | the data update frequency               | 4      |
        | a geo location                          | 3      |
        | a NUTS location                         | 3      |
        | the transport mode                      | 2      |
        | the geo reference method                | 1      |

      Examples: Trusting the data (15 points in total)
        | information                | points |
        | a standard license         | 6      |
        | the conditions for use     | 3      |
        | the publisher              | 3      |
        | the sovereign's legal name | 3      |

    Scenario: A geo location and a NUTS location together earn the geo points once
      When the provider adds a geo location
      And the provider adds a NUTS location
      Then the offer's score rises by 3 points

    Scenario: Several data samples earn the data sample points once
      When the provider adds 3 data samples
      Then the offer's score rises by 8 points

    Scenario: The language never earns points
      When the provider changes the language to "German"
      Then the offer's score does not change

  Rule: The description earns points for its length

    Scenario Outline: A description of <words> words earns <points> points
      When the provider writes a description of <words> words
      Then the offer's score rises by <points> points

      Examples:
        | words | points |
        | 0     | 0      |
        | 1     | 3      |
        | 4     | 3      |
        | 5     | 8      |
        | 19    | 8      |
        | 20    | 14     |
        | 49    | 14     |
        | 50    | 19     |
        | 149   | 19     |
        | 150   | 22     |
        | 400   | 22     |

  Rule: A description of 20 words or more earns 3 extra points for structure, up to 25

    Scenario Outline: A <words>-word description with <structure> earns <points> points
      When the provider writes a description of <words> words that uses <structure>
      Then the offer's score rises by <points> points

      Examples:
        | words | structure       | points |
        | 10    | a bulleted list | 8      |
        | 30    | a bulleted list | 17     |
        | 100   | headings        | 22     |
        | 200   | a table         | 25     |

  Rule: A description that only repeats the title earns nothing

    Scenario Outline: The description "<description>" for the title "<title>"
      Given the offer's title is "<title>"
      When the provider writes the description "<description>"
      Then the offer's score does not change

      Examples:
        | title       | description         |
        | IAV Logo 12 | IAV Logo 12 desc    |
        | Demo 1      | Demo 1              |
        | Asset 3     | Asset 3 description |

    Scenario: A short description that adds something new still counts
      Given the offer's title is "HERE - DFRS Incidents"
      When the provider writes the description "Incidents from HERE WeGo for DFRS."
      Then the offer's score rises by 8 points

  Rule: Only a meaningful title earns the title points

    Scenario Outline: The title "<title>" gives a score of <score>
      When the provider changes the title to "<title>"
      Then the offer's score is <score> out of 100

      Examples:
        | title                                | score |
        | Parking occupancy Berlin             | 8     |
        | eacde66e-5bab-4af4-ad79-0171a07b1a2f | 3     |
        | ddtr_1751011857@BPNL00000000Q7M3     | 3     |

    Scenario: A title identical to the asset ID earns nothing
      When the provider changes the title to "parking-occupancy-berlin"
      And the offer's asset ID is "parking-occupancy-berlin"
      Then the offer's score is 3 out of 100

  Rule: A specific data category earns more than "Other"

    Scenario Outline: The data category "<category>" gives a score of <score>
      When the provider sets the data category to "<category>"
      Then the offer's score is <score> out of 100

      Examples:
        | category                                  | score |
        | Parking Service and Rest Area Information | 8     |
        | Real Time Traffic Data                    | 8     |
        | Other                                     | 6     |

    Scenario: An offer without a data category yet earns no category points
      When the provider clears the data category
      Then the offer's score is 5 out of 100

  Rule: The score is rounded to the nearest whole number, halves up

    Scenario: Only a temporal coverage start date earns half the temporal coverage points
      When the provider adds a temporal coverage start date
      Then the offer's score is 11 out of 100
      # 8 + 2.5 = 10.5, shown as 11

  Rule: A fully described offer scores 100

    Scenario: Every piece of information is complete and valid
      Given the offer has every piece of information, complete and valid
      Then the offer's score is 100 out of 100
      And the offer's band is "Excellent"
