Feature: Live Workout Logging & Summary Calculations
  As a gym athlete
  I want to log my sets in real-time and finish my workout
  So that my total training volume and session duration are recorded

  Scenario: Logging sets and calculating volume on workout completion
    Given an in-progress workout with "Barbell Bench Press"
    When the user logs a completed normal set with 100 kg for 5 reps
    And the user logs a completed warmup set with 60 kg for 10 reps
    And the user logs an uncompleted normal set with 100 kg for 5 reps
    And the user finishes the workout
    Then the workout total volume is 500 kg
    And the workout status is "finished"
    And a "WorkoutFinished" domain event is published

  Scenario: Attempting to finish a workout without completed sets is rejected
    Given an in-progress workout with "Barbell Bench Press"
    When the user logs an uncompleted set with 100 kg for 5 reps
    And the user attempts to finish the workout
    Then the operation is rejected with an error "no completed sets"
