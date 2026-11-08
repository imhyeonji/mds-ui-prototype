@metadata-quality-score
Feature: Only valid information earns points
  The form accepts any text in most fields, so the score checks each value itself.
  Empty, placeholder and misplaced values earn no points.

  Background:
    Given a new data offer with only the required information

  Rule: Placeholders earn nothing, whatever their capitalisation

    Scenario Outline: "<value>" as <information> earns nothing
      When the provider enters "<value>" as <information>
      Then the offer's score does not change

      Examples:
        | information                | value         |
        | the geo reference method   | N/A           |
        | the geo reference method   | n/a           |
        | the data model             | TBD           |
        | the sovereign's legal name | to be defined |
        | the data update frequency  | -             |
        | the conditions for use     | test          |
        | a version                  | none          |
        | a keyword                  | unknown       |
        | the data model             |               |

  Rule: Links must be web addresses starting with http:// or https://

    Scenario Outline: "<value>" as <information> earns <points> points
      When the provider enters "<value>" as <information>
      Then the offer's score rises by <points> points

      Examples: Valid web addresses
        | information                | value                                        | points |
        | the standard license       | https://creativecommons.org/licenses/by/4.0/ | 6      |
        | the standard license       | http://opendatacommons.org/licenses/odbl/    | 6      |
        | the publisher              | https://www.bmwgroup.com                     | 3      |
        | the endpoint documentation | https://example.com/api/docs                 | 5      |
        | a data sample              | https://example.com/sample.csv               | 8      |
        | a reference file           | https://example.com/schema.json              | 6      |

      Examples: Not web addresses
        | information                | value                     | points |
        | the standard license       | not a url                 | 0      |
        | the standard license       | ftp://example.com/license | 0      |
        | the publisher              | BMW AG                    | 0      |
        | the endpoint documentation | www.example.com/docs      | 0      |
        | a data sample              | sample.csv                | 0      |
        | a reference file           | schema.json               | 0      |

    Scenario: One valid data sample among invalid ones is enough
      When the provider adds the data samples "sample.csv" and "https://example.com/sample.csv"
      Then the offer's score rises by 8 points

  Rule: The content type must name a data format

    Scenario Outline: "<value>" as the content type earns <points> points
      When the provider enters "<value>" as the content type
      Then the offer's score rises by <points> points

      Examples:
        | value                                                         | points |
        | application/json                                              | 5      |
        | text/csv                                                      | 5      |
        | GeoJSON                                                       | 5      |
        | DATEX II                                                      | 5      |
        | https://www.iana.org/assignments/media-types/application/json | 5      |
        | cluj bike                                                     | 0      |
        | Air Quality in Cluj-Napoca                                    | 0      |

  Rule: The sovereign is a legal name, not a web address

    Scenario Outline: "<value>" as the sovereign's legal name earns <points> points
      When the provider enters "<value>" as the sovereign's legal name
      Then the offer's score rises by <points> points

      Examples:
        | value                    | points |
        | BMW AG                   | 3      |
        | https://www.bmwgroup.com | 0      |
