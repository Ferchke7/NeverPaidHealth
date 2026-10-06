import urllib.request
import json

def test_start_routine():
    # 1. Login
    req = urllib.request.Request(
        'http://localhost:3002/api/v1/auth/dev-login',
        data=json.dumps({'email': 'athlete@neverpaid.health', 'display_name': 'Pro Lifter'}).encode('utf-8'),
        headers={'Content-Type': 'application/json'}
    )
    with urllib.request.urlopen(req) as resp:
        data = json.loads(resp.read().decode('utf-8'))
        token = data['access_token']

    # 2. Get routines
    req2 = urllib.request.Request(
        'http://localhost:3002/api/v1/routines',
        headers={'Authorization': f'Bearer {token}'}
    )
    with urllib.request.urlopen(req2) as resp:
        routines = json.loads(resp.read().decode('utf-8'))
        print(f"Loaded {len(routines)} routines")

    # 3. Start Routine 1 (Push 1)
    r1 = routines[0]
    print(f"Starting routine: {r1['name']} ({r1['id']})")
    req3 = urllib.request.Request(
        'http://localhost:3002/api/v1/workouts',
        data=json.dumps({'routine_id': r1['id'], 'name': r1['name']}).encode('utf-8'),
        headers={'Content-Type': 'application/json', 'Authorization': f'Bearer {token}'}
    )
    try:
        with urllib.request.urlopen(req3) as resp:
            w1 = json.loads(resp.read().decode('utf-8'))
            print("Workout 1 response:")
            print(json.dumps(w1, indent=2))
    except Exception as e:
        print("Workout 1 error:", e)

    # 4. Now start Routine 2 (Pull 1) without finishing Routine 1 (simulating user clicking another routine)
    r2 = routines[1]
    print(f"\nStarting second routine without finishing first: {r2['name']} ({r2['id']})")
    req4 = urllib.request.Request(
        'http://localhost:3002/api/v1/workouts',
        data=json.dumps({'routine_id': r2['id'], 'name': r2['name']}).encode('utf-8'),
        headers={'Content-Type': 'application/json', 'Authorization': f'Bearer {token}'}
    )
    try:
        with urllib.request.urlopen(req4) as resp:
            w2 = json.loads(resp.read().decode('utf-8'))
            print("Workout 2 response:")
            print(json.dumps(w2, indent=2))
    except Exception as e:
        print("Workout 2 error:", e)

if __name__ == '__main__':
    test_start_routine()
