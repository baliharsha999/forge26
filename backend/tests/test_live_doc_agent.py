import pytest
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)

def test_locate_id_10th_roll():
    res = client.post('/api/v1/agent/locate-id', json={
        'id_query': 'where is my 10th roll number',
        'portal_context': 'JEE (Main) Official Candidate Portal (NTA)'
    })
    assert res.status_code == 200
    data = res.json()
    assert "10th" in data['id_name'] or "Roll" in data['id_name']
    assert "TOP-RIGHT" in data['visual_location_badge']

def test_locate_id_apaar():
    res = client.post('/api/v1/agent/locate-id', json={
        'id_query': 'where do I find my APAAR ID or ABC ID',
        'portal_context': 'JEE (Main) Official Candidate Portal (NTA)'
    })
    assert res.status_code == 200
    data = res.json()
    assert "APAAR" in data['id_name']
    assert "abc.gov.in" in data['online_url']

def test_extract_document_fields():
    test_b64 = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=="
    res = client.post('/api/v1/agent/extract-document', json={
        'image_base64': test_b64,
        'portal_context': 'JEE (Main) Official Candidate Portal (NTA)',
        'document_hint': 'marksheet_10th'
    })
    assert res.status_code == 200
    data = res.json()
    assert data['autofill_ready'] is True
    assert len(data['field_items']) > 0
    assert any(f['key'] == 'roll_number' for f in data['field_items'])

def test_analyze_intent_id_locator():
    res = client.post('/api/v1/grievance/analyze', json={
        'raw_input': 'where is my 10th roll number on marksheet',
        'portal_context': 'JEE (Main) Official Candidate Portal (NTA)'
    })
    assert res.status_code == 200
    data = res.json()
    assert data['intent'] == "ID_LOCATOR"
    assert "10th" in data['guidance_title'] or "Roll" in data['guidance_title']
