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

def test_schemes_search():
    response = client.get("/api/v1/schemes?category=farmer")
    assert response.status_code == 200
    schemes = response.json()
    assert len(schemes) >= 1
    assert any("Kisan" in s["title"] for s in schemes)

def test_fact_check_bogus_claim():
    response = client.post("/api/v1/fact-check", json={"claim": "Govt is giving free laptop to all students"})
    assert response.status_code == 200
    data = response.json()
    assert data["verdict"] == "BOGUS"
    assert data["truth_score"] <= 20
    assert "PIB" in data["official_source_citation"]

def test_fact_check_verified_claim():
    response = client.post("/api/v1/fact-check", json={"claim": "Ayushman Bharat free health cover for senior citizens aged 70 and above"})
    assert response.status_code == 200
    data = response.json()
    assert data["verdict"] == "VERIFIED"
    assert data["truth_score"] == 100

def test_grievance_analysis():
    response = client.post("/api/v1/grievance/analyze", json={
        "raw_input": "Very big pothole on road near Kukatpally metro station, bike fallen yesterday",
        "language": "en"
    })
    assert response.status_code == 200
    data = response.json()
    assert data["urgency_level"] == "HIGH"
    assert "Road" in data["category"] or "Pothole" in data["category"]

def test_autonomous_grievance_submission():
    payload = {
        "citizen": {
            "name": "Arjun Kumar",
            "phone": "+91 98765 43210",
            "state": "Telangana",
            "district": "Hyderabad",
            "locality": "Ameerpet Ward 10"
        },
        "department": "Municipal Corporation & Public Works",
        "category": "Pot-holes & Damaged Roads",
        "urgency_level": "HIGH",
        "title": "Severe road cavity obstructing traffic",
        "description": "Continuous damage after pipe repair, unbarricaded.",
        "location": "Ameerpet Metro Station Pillar 12"
    }
    response = client.post("/api/v1/grievance/submit", json=payload)
    assert response.status_code == 200
    result = response.json()
    assert result["tracking_id"].startswith("CP-2026-")
    assert result["status"] == "OFFICIALLY_REGISTERED"
    assert len(result["browser_agent_telemetry"]) > 0

    # Verify grievance is in live DB
    track_resp = client.get(f"/api/v1/grievance/track/{result['tracking_id']}")
    assert track_resp.status_code == 200
    assert track_resp.json()["citizen_name"] == "Arjun Kumar"
