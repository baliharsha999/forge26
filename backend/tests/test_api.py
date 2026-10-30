import pytest
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)

def test_root():
    response = client.get("/")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "online"
    assert "endpoints" in data

def test_health():
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json()["status"] == "healthy"

def test_mock_portal_routes():
    # Verify mock municipal portal loads
    res = client.get("/portal")
    assert res.status_code == 200
    assert "DEMO MUNICIPAL PORTAL" in res.text
    assert "citizen-name" in res.text

    # Verify operator admin page loads
    admin_res = client.get("/portal/admin")
    assert admin_res.status_code == 200
    assert "DEMO OPERATOR DASHBOARD" in admin_res.text

def test_schemes_and_eligibility():
    res = client.get("/api/v1/schemes?category=farmer")
    assert res.status_code == 200
    schemes = res.json()
    assert len(schemes) >= 1

    elig_res = client.post("/api/v1/schemes/eligibility", json={
        "occupation": "farmer",
        "landholder": True,
        "age": 40
    })
    assert elig_res.status_code == 200
    matches = elig_res.json()["likely_eligible_schemes"]
    assert len(matches) >= 1
    assert "PM-KISAN" in matches[0]["scheme_name"]

def test_fact_check_outcomes():
    # Matches
    m_res = client.post("/api/v1/fact-check", json={"claim": "PM-KISAN gives farmers Rs 6,000 per year in three installments"})
    assert m_res.status_code == 200
    assert m_res.json()["outcome"] == "matches"
    assert m_res.json()["truth_score"] == 100

    # Contradicts
    c_res = client.post("/api/v1/fact-check", json={"claim": "Central Government is giving free laptops to all students in 2026"})
    assert c_res.status_code == 200
    assert c_res.json()["outcome"] == "contradicts"

    # Unverified
    u_res = client.post("/api/v1/fact-check", json={"claim": "Local village council distributed free umbrellas yesterday"})
    assert u_res.status_code == 200
    assert u_res.json()["outcome"] == "unverified"

def test_grievance_analysis_with_pii_check():
    res = client.post("/api/v1/grievance/analyze", json={
        "raw_input": "Water pipe broken at Door 12-4, my Aadhaar is 9876 5432 1098 please fix",
        "language": "en"
    })
    assert res.status_code == 200
    data = res.json()
    assert data["privacy_warning"] is not None
    assert "Aadhaar" in data["privacy_warning"]

def test_statutory_escalation_draft():
    # Seed a grievance first or use pre-seeded one
    res = client.get("/api/v1/grievance/list")
    assert res.status_code == 200
    grievances = res.json()
    assert len(grievances) >= 1
    sample_id = grievances[0]["tracking_id"]

    # Test Reminder draft
    rem_res = client.post("/api/v1/escalate", json={
        "tracking_id": sample_id,
        "escalation_type": "reminder",
        "days_elapsed": 16
    })
    assert rem_res.status_code == 200
    data = rem_res.json()
    assert "REMINDER" in data["subject_line"]
    assert sample_id in data["letter_body"]

    # Test RTI draft
    rti_res = client.post("/api/v1/escalate", json={
        "tracking_id": sample_id,
        "escalation_type": "rti",
        "days_elapsed": 20
    })
    assert rti_res.status_code == 200
    assert "SECTION 6(1)" in rti_res.json()["subject_line"]
