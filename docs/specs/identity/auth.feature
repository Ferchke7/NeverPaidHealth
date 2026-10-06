Feature: User Authentication & Unit Preference Management
  As a gym athlete
  I want to sign in securely and configure my preferred weight unit
  So that I can track my workouts seamlessly

  Scenario: First-time Google login registers a new user with default kg units
    Given no user exists with Google ID "google-sub-123"
    When the user authenticates with Google ID token containing email "athlete@example.com" and sub "google-sub-123"
    Then a new user account is created with email "athlete@example.com"
    And the user's unit preference is set to "kg"
    And an access token is returned

  Scenario: Existing user login returns existing profile
    Given a user exists with Google ID "google-sub-123" and unit preference "lb"
    When the user authenticates with Google ID token containing sub "google-sub-123"
    Then the existing user profile is returned
    And the user's unit preference remains "lb"

  Scenario: User updates unit preference to pounds
    Given an authenticated user with unit preference "kg"
    When the user updates their unit preference to "lb"
    Then their profile reflects unit preference "lb"
