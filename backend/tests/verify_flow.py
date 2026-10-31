import urllib.request
import json
import sys

def test_api(url, data):
    req = urllib.request.Request(
        'http://localhost:8000' + url,
        data=json.dumps(data).encode('utf-8'),
        headers={'Content-Type': 'application/json'}
    )
    with urllib.request.urlopen(req) as res:
        return json.loads(res.read().decode('utf-8'))

print("=== 1. Test study-page on Google / New Tab ===")
res_google = test_api('/api/v1/agent/study-page', {'url': 'https://www.google.com', 'title': 'Google'})
print(f"Portal: {res_google['portal_name']} | Type: {res_google['portal_type']}")
assert res_google['portal_name'] == "No Civic Portal Active"
assert res_google['portal_type'] == "STANDBY"

print("\n=== 2. Test study-page on JEE Main ===")
res_jee = test_api('/api/v1/agent/study-page', {'url': 'https://jeemain.nta.nic.in', 'title': 'JEE(Main) NTA'})
print(f"Portal: {res_jee['portal_name']} | Type: {res_jee['portal_type']} | Chips: {len(res_jee['chips'])}")
assert "JEE" in res_jee['portal_name']
assert res_jee['portal_type'] == "EXAM_ADMISSION"

print("\n=== 3. Test analyze on 'how to apply for jee main' ===")
res_analyze_jee = test_api('/api/v1/grievance/analyze', {
    'raw_input': 'how to apply for jee main',
    'language': 'en',
    'portal_context': res_jee['portal_name']
})
print(f"Intent: {res_analyze_jee['intent']} | Steps: {len(res_analyze_jee.get('steps') or [])}")
assert res_analyze_jee['intent'] == "PORTAL_GUIDANCE"
assert len(res_analyze_jee['steps']) == 3
for s in res_analyze_jee['steps']:
    print(f"  [{s['badge']}] {s['title']} -> Target: {s['target_text']}")
    print(f"    Voice: \"{s['voice_speech']}\"")

print("\n=== 4. Test analyze on CPGRAMS 'help me sign in' ===")
res_analyze_signin = test_api('/api/v1/grievance/analyze', {
    'raw_input': 'help me sign in for this page',
    'language': 'en',
    'portal_context': 'Central Public Grievance Portal (CPGRAMS)'
})
print(f"Intent: {res_analyze_signin['intent']} | Steps: {len(res_analyze_signin.get('steps') or [])}")
assert res_analyze_signin['intent'] == "PORTAL_GUIDANCE"
assert len(res_analyze_signin['steps']) == 2
for s in res_analyze_signin['steps']:
    print(f"  [{s['badge']}] {s['title']} -> Target: {s['target_text']}")
    print(f"    Voice: \"{s['voice_speech']}\"")

print("\n=== ALL E2E API VERIFICATIONS PASSED 100%! ===")
