Feature: Personal Records (PR) Detection & Progression Analytics
  As a gym athlete
  I want my Personal Records to be automatically detected and charted
  So that I can see my strength progression over time

  Scenario: Completing a heavier set records a new Heaviest Weight PR
    Given an athlete with historical best "Barbell Bench Press" of 80 kg
    When a "WorkoutFinished" event is processed containing "Barbell Bench Press" set of 82.5 kg for 5 reps
    Then a new "heaviest_weight" personal record of 82.5 kg is recorded
    And a new "best_e1rm" personal record of 96.3 kg is recorded

  Scenario: Lifting lighter weight does not create new PRs
    Given an athlete with historical best "Barbell Bench Press" of 100 kg
    When a "WorkoutFinished" event is processed containing "Barbell Bench Press" set of 90 kg for 5 reps
    Then no new personal records are generated
    And the historical data point is appended to the chart series
