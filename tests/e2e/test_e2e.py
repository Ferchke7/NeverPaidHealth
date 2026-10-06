import urllib.request
import json

def run_tests():
    print("=== Testing NeverPaid Health Production Endpoints ===")
    
    # 1. Dev Login
    req = urllib.request.Request(
        'http://localhost:3002/api/v1/auth/dev-login',
        data=json.dumps({'email': 'athlete@neverpaid.health', 'display_name': 'Pro Lifter'}).encode('utf-8'),
        headers={'Content-Type': 'application/json'}
    )
    with urllib.request.urlopen(req) as resp:
        data = json.loads(resp.read().decode('utf-8'))
        token = data['access_token']
        print(f"1. [SUCCESS] Dev Login: Authenticated as {data['user']['email']} (ID: {data['user']['id']})")

    # 2. Get Profile / Me
    req = urllib.request.Request(
        'http://localhost:3002/api/v1/profile/me',
        headers={'Authorization': f'Bearer {token}'}
    )
    with urllib.request.urlopen(req) as resp:
        profile = json.loads(resp.read().decode('utf-8'))
        print(f"2. [SUCCESS] Profile: {profile['display_name']}, Unit Pref: {profile.get('unit_preference', 'kg')}")

    # 3. List Routines
    req = urllib.request.Request(
        'http://localhost:3002/api/v1/routines',
        headers={'Authorization': f'Bearer {token}'}
    )
    with urllib.request.urlopen(req) as resp:
        routines = json.loads(resp.read().decode('utf-8'))
        print(f"3. [SUCCESS] Routines fetched: {len(routines)} available")
        for r in routines[:4]:
            print(f"   - {r['name']} ({len(r.get('exercises', []))} exercises)")

    # 4. Start Routine
    jeff_ppl = routines[0]
    req = urllib.request.Request(
        'http://localhost:3002/api/v1/workouts',
        data=json.dumps({'routine_id': jeff_ppl['id'], 'name': jeff_ppl['name']}).encode('utf-8'),
        headers={'Content-Type': 'application/json', 'Authorization': f'Bearer {token}'}
    )
    with urllib.request.urlopen(req) as resp:
        workout = json.loads(resp.read().decode('utf-8'))
        print(f"4. [SUCCESS] Started Routine Workout: {workout['name']} (ID: {workout['id']})")

    # 5. AI Coach Insights & CNS Recovery Score
    req = urllib.request.Request(
        'http://localhost:3002/api/v1/coach/insights',
        headers={'Authorization': f'Bearer {token}'}
    )
    with urllib.request.urlopen(req) as resp:
        insights = json.loads(resp.read().decode('utf-8'))
        print(f"5. [SUCCESS] AI Coach CNS Readiness: {insights['readiness_score']}/100, Status: {insights['recovery_status']}, Split: {insights['suggested_split']}")

    # 6. AI Coach Interactive Consultation
    req = urllib.request.Request(
        'http://localhost:3002/api/v1/coach/chat',
        data=json.dumps({'message': 'Привет! Как мне оптимизировать прогрессивную перегрузку?'}).encode('utf-8'),
        headers={'Content-Type': 'application/json', 'Authorization': f'Bearer {token}'}
    )
    with urllib.request.urlopen(req) as resp:
        coach_resp = json.loads(resp.read().decode('utf-8'))
        print(f"6. [SUCCESS] AI Coach Advice: {coach_resp['reply'][:120]}...")

    print("=== All Server Verification Checks Passed 100% Successfully! ===")

if __name__ == '__main__':
    run_tests()
