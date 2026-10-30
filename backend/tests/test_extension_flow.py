import re
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)

def test_mock_portal_selectors_intact():
    """
    Contract Test for Chrome Extension's MockPortalAdapter:
    Verifies that all required selectors are present in http://localhost:8000/portal HTML.
    """
    res = client.get("/portal")
    assert res.status_code == 200
    html = res.text

    # Verify all expected element IDs are in the DOM
    required_ids = [
        "complaint-form",
        "citizen-name",
        "citizen-phone",
        "department-select",
        "category-select",
        "urgency-select",
        "location-input",
        "description-textarea",
        "photo-upload",
        "submit-button",
        "tracking-id"
    ]

    for element_id in required_ids:
        assert f'id="{element_id}"' in html or f"id='{element_id}'" in html, f"Selector #{element_id} missing from portal DOM"

def test_operator_status_toggle():
    """
    Verifies that the Mock Portal Operator Dashboard can update a complaint's status to Overdue.
    """
    # 1. Fetch initial complaints
    list_res = client.get("/api/v1/grievance/list")
    assert list_res.status_code == 200
    complaints = list_res.json()
    assert len(complaints) > 0
    sample_id = complaints[0]["tracking_id"]

    # 2. Toggle to Overdue
    toggle_res = client.post("/portal/admin/toggle-status", json={
        "tracking_id": sample_id,
        "status": "Overdue"
    })
    assert toggle_res.status_code == 200
    assert toggle_res.json()["new_status"] == "Overdue"

    # 3. Check tracking endpoint reflects the updated status
    track_res = client.get(f"/api/v1/grievance/track/{sample_id}")
    assert track_res.status_code == 200
    assert track_res.json()["status"] == "Overdue"
