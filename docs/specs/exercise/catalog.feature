Feature: Exercise Catalog & Custom Movements
  As a gym athlete
  I want to browse standard exercises and create custom ones
  So that I can log any gym movement accurately

  Scenario: Filtering exercises by muscle group and equipment
    Given the standard exercise catalog is loaded
    When the user requests exercises for muscle group "chest" and equipment "barbell"
    Then the result includes "Barbell Bench Press" and "Incline Barbell Bench Press"
    And excludes "Dumbbell Bicep Curl"

  Scenario: Creating a custom user exercise
    Given an authenticated user
    When the user creates a custom exercise "Cable Lat Pullover" for muscle group "back" and equipment "cable"
    Then the exercise is saved with is_custom set to true
    And the exercise is visible to the user

  Scenario: Attempting to delete a seeded standard exercise fails
    Given a seeded standard exercise "Barbell Squat"
    When the user attempts to delete "Barbell Squat"
    Then the operation is rejected with an immutable exercise error
