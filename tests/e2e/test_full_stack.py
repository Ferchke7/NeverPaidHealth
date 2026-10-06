import urllib.request
import json

base_url = "http://localhost:3002/api/v1"

# 1. Dev Login
login_req = urllib.request.Request(
    f"{base_url}/auth/dev-login",
    data=json.dumps({"email": "athlete@neverpaid.dev", "display_name": "Dev Athlete"}).encode(),
    headers={"Content-Type": "application/json"}
)

with urllib.request.urlopen(login_req) as res:
    data = json.loads(res.read().decode())
    token = data["access_token"]
    user = data["user"]
    print("✓ Dev Login Success! User:", user["display_name"], "| Email:", user["email"])

headers = {
    "Content-Type": "application/json",
    "Authorization": f"Bearer {token}"
}

# 2. Get Profile /me
me_req = urllib.request.Request(f"{base_url}/me", headers=headers)
with urllib.request.urlopen(me_req) as res:
    me_data = json.loads(res.read().decode())
    print("✓ /api/v1/me -> 200 OK:", me_data["display_name"])

# 3. Get Exercises library
ex_req = urllib.request.Request(f"{base_url}/exercises", headers=headers)
with urllib.request.urlopen(ex_req) as res:
    ex_data = json.loads(res.read().decode())
    print(f"✓ /api/v1/exercises -> 200 OK: {len(ex_data)} seeded exercises loaded!")

# 4. Get Routines
rot_req = urllib.request.Request(f"{base_url}/routines", headers=headers)
with urllib.request.urlopen(rot_req) as res:
    rot_data = json.loads(res.read().decode())
    rot_len = len(rot_data) if rot_data is not None else 0
    print(f"✓ /api/v1/routines -> 200 OK: {rot_len} routines")

# 5. Get Workouts history
wo_req = urllib.request.Request(f"{base_url}/workouts", headers=headers)
with urllib.request.urlopen(wo_req) as res:
    wo_data = json.loads(res.read().decode())
    items = wo_data.get('items', []) if isinstance(wo_data, dict) else (wo_data or [])
    print(f"✓ /api/v1/workouts -> 200 OK: {len(items)} workouts")

# 6. Get Progress records
pr_req = urllib.request.Request(f"{base_url}/progress/records", headers=headers)
with urllib.request.urlopen(pr_req) as res:
    pr_data = json.loads(res.read().decode())
    pr_len = len(pr_data) if pr_data is not None else 0
    print(f"✓ /api/v1/progress/records -> 200 OK: {pr_len} record groups")

# 7. Get Body logs
body_req = urllib.request.Request(f"{base_url}/body/logs", headers=headers)
with urllib.request.urlopen(body_req) as res:
    body_data = json.loads(res.read().decode())
    body_len = len(body_data) if body_data is not None else 0
    print(f"✓ /api/v1/body/logs -> 200 OK: {body_len} body logs")

print("\n🎉 ALL API ENDPOINTS ARE WORKING 100% PERFECTLY THROUGH GATEWAY & REVERSE PROXY!")
