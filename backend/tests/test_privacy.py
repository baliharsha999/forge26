from app.services.privacy_service import inspect_and_sanitize_pii

def test_aadhaar_detection_and_masking():
    # Test valid 12-digit Aadhaar in complaint text
    text = "Citizen Aadhaar number is 9876 5432 1098, please check status."
    sanitized, warning = inspect_and_sanitize_pii(text)
    
    assert warning is not None
    assert "Aadhaar" in warning
    assert "9876 5432 1098" not in sanitized
    assert "XXXX-XXXX-1098" in sanitized

def test_clean_input_without_pii():
    text = "Large pothole near Kukatpally metro station."
    sanitized, warning = inspect_and_sanitize_pii(text)
    
    assert warning is None
    assert sanitized == text
