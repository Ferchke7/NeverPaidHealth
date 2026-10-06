Feature: Routine Templates & Workout Instantiation
  As a gym athlete
  I want to create reusable routine templates and start workouts from them
  So that I don't have to select exercises from scratch each time

  Scenario: Creating a routine template and starting a workout
    Given an authenticated user
    When the user creates a routine "Push Day A" with exercises "Barbell Bench Press" (3 sets) and "Overhead Press" (3 sets)
    Then the routine is saved with 2 exercises
    When the user starts a workout from routine "Push Day A"
    Then a new in-progress workout is created containing "Barbell Bench Press" and "Overhead Press" in exact order
