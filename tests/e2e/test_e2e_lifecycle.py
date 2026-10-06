import urllib.request
import json
import time

base = "http://localhost:3002/api/v1"

def post(url, payload, token=None):
    headers = {"Content-Type": "application/json"}
    if token:
        headers["Authorization"] = f"Bearer {token}"
    req = urllib.request.Request(url, data=json.dumps(payload).encode(), headers=headers, method="POST")
    with urllib.request.urlopen(req) as res:
        return json.loads(res.read().decode())

def get(url, token=None):
    headers = {"Content-Type": "application/json"}
    if token:
        headers["Authorization"] = f"Bearer {token}"
    req = urllib.request.Request(url, headers=headers)
    with urllib.request.urlopen(req) as res:
        return json.loads(res.read().decode())

print("1. Logging in...")
login_res = post(f"{base}/auth/dev-login", {"email": "athlete@neverpaid.dev", "display_name": "Dev Athlete"})
token = login_res["access_token"]
print("✓ Logged in as:", login_res["user"]["display_name"])

print("\n2. Fetching Exercise Library...")
exercises = get(f"{base}/exercises", token)
bench_press = next(ex for ex in exercises if ex["name"] == "Barbell Bench Press")
print("✓ Found exercise:", bench_press["name"], "(ID:", bench_press["id"], ")")

print("\n3. Creating Routine Template...")
routine = post(f"{base}/routines", {
    "name": "Chest & Triceps Push A",
    "notes": "Heavy compound focus",
    "exercises": [
        {
            "exercise_id": bench_press["id"],
            "target_sets": 3,
            "target_reps_min": 5,
            "target_reps_max": 8
        }
    ]
}, token)
print("✓ Created routine:", routine["name"], "(ID:", routine["id"], ")")

print("\n4. Starting Workout from Routine...")
workout = post(f"{base}/workouts", {
    "name": "Chest & Triceps Push A",
    "routine_id": routine["id"]
}, token)
workout_id = workout["id"]
print("✓ Started workout:", workout["name"], "(ID:", workout_id, ")")

print("\n5. Adding Exercise & Logging Sets...")
we = post(f"{base}/workouts/{workout_id}/exercises", {
    "exercise_id": bench_press["id"]
}, token)

set1 = post(f"{base}/workouts/{workout_id}/exercises/{bench_press['id']}/sets", {
    "set_type": "normal",
    "weight_kg": 100.0,
    "reps": 5
}, token)
print("✓ Logged Set 1: 100kg x 5 reps -> E1RM:", set1.get("calculated_e1rm_kg"), "kg")

set2 = post(f"{base}/workouts/{workout_id}/exercises/{bench_press['id']}/sets", {
    "set_type": "normal",
    "weight_kg": 105.0,
    "reps": 5
}, token)
print("✓ Logged Set 2: 105kg x 5 reps -> E1RM:", set2.get("calculated_e1rm_kg"), "kg")

print("\n6. Finishing Workout Session...")
finished_workout = post(f"{base}/workouts/{workout_id}/finish", {}, token)
print("✓ Workout Finished! Total Volume:", finished_workout.get("total_volume_kg"), "kg | Completed sets:", finished_workout.get("completed_sets_count"))

print("\n7. Logging Daily Body Measurement...")
body_log = post(f"{base}/body/logs", {
    "log_date": "2026-10-06",
    "weight_kg": 80.0,
    "height_cm": 180.0,
    "body_fat_percentage": 14.5,
    "waist_cm": 82.0
}, token)
print("✓ Body Log Recorded! Weight: 80.0kg | Calculated BMI:", body_log.get("calculated_bmi"))

print("\n8. Fetching 7-Day Moving Average Trend...")
trend = get(f"{base}/body/trend", token)
print("✓ Body Trend -> Current Weight:", trend.get("current_weight_kg"), "kg | 7-day SMA:", trend.get("current_7day_sma_kg"), "kg")

print("\n========================================================")
print("🎉 FULL END-TO-END WORKOUT & METRICS LIFECYCLE VERIFIED!")
print("========================================================")
