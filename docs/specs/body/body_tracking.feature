Feature: Daily Body Measurements & Moving Average Trend
  As a gym athlete
  I want to log my daily body metrics and view a smoothed trend line
  So that I can monitor my physical progress without daily water weight noise

  Scenario: Logging daily body weight calculates BMI and updates 7-day trend
    Given an athlete with height 180 cm and prior 6 daily weights [80.0, 80.5, 80.2, 79.8, 80.1, 79.9]
    When the athlete logs a weight of 80.3 kg for today
    Then their BMI is calculated as 24.7
    And their 7-day moving average weight is 80.1 kg

  Scenario: Logging a measurement for an existing date updates the record
    Given an athlete with a logged weight of 80.0 kg on "2026-10-06"
    When the athlete logs a revised weight of 79.5 kg on "2026-10-06"
    Then the record for "2026-10-06" is updated to 79.5 kg
    And only one entry exists for date "2026-10-06"
