/**
 * JanSetu Lite Side Panel Logic
 * Features:
 * - Active Page Form Inspection
 * - Gemini 3.8 Flash Multimodal Synthesis
 * - Field-by-Field Interactive Guided Intake
 * - GPS Reverse Geocoding
 * - Individual & Bulk Field Population
 * - Offline Fallback & Claim Fact-Checking
 */
document.addEventListener("DOMContentLoaded", () => {
  let currentLang = "en";
  let photoBase64 = null;
  let synthesizedComplaint = null;

  // DOM Elements - General
  const rawInput = document.getElementById("raw-input");
  const micBtn = document.getElementById("mic-btn");
  const photoInput = document.getElementById("photo-input");
  const photoPreview = document.getElementById("photo-preview");
  const photoImg = document.getElementById("photo-img");
  const photoStatusText = document.getElementById("photo-status-text");
  const removePhotoBtn = document.getElementById("remove-photo");
  const analyzeBtn = document.getElementById("analyze-btn");
  
  const privacyBanner = document.getElementById("privacy-banner");
  const tabStatusBanner = document.getElementById("tab-status-banner");
  const tabStatusText = document.getElementById("tab-status-text");

  // DOM Elements - Inspector
  const inspectorCard = document.getElementById("inspector-card");
  const inspectorStatusText = document.getElementById("inspector-status-text");
  const reinspectBtn = document.getElementById("reinspect-btn");
  const pillbox = document.getElementById("inspection-fields-pillbox");

  // DOM Elements - Intake & Confirmation Card
  const confirmationCard = document.getElementById("confirmation-card");
  const confUrgency = document.getElementById("conf-urgency");
  const confCategory = document.getElementById("conf-category");
  const followupBox = document.getElementById("followup-box");
  const followupText = document.getElementById("followup-text");

  const citizenName = document.getElementById("citizen-name");
  const citizenPhone = document.getElementById("citizen-phone");
  const editDept = document.getElementById("edit-department");
  const editCat = document.getElementById("edit-category");
  const editUrgency = document.getElementById("edit-urgency");
  const editLoc = document.getElementById("edit-location");
  const editDesc = document.getElementById("edit-description");

  const badgeName = document.getElementById("badge-name");
  const badgePhone = document.getElementById("badge-phone");
  const badgeLoc = document.getElementById("badge-loc");
  const detectGpsBtn = document.getElementById("detect-gps-btn");
  const fillPortalBtn = document.getElementById("fill-portal-btn");

  const handoffCard = document.getElementById("handoff-card");
  const hfDept = document.getElementById("hf-dept");
  const hfLoc = document.getElementById("hf-loc");
  const hfDesc = document.getElementById("hf-desc");

  const receiptCard = document.getElementById("receipt-card");
  const receiptTrackingId = document.getElementById("receipt-tracking-id");

  // Tab Switching
  document.querySelectorAll(".tab-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".tab-btn").forEach(b => b.classList.remove("active"));
      document.querySelectorAll(".tab-content").forEach(c => c.classList.remove("active"));
      btn.classList.add("active");
      document.getElementById(btn.dataset.target).classList.add("active");
    });
  });

  // Language Selector
  document.querySelectorAll(".lang-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".lang-btn").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      currentLang = btn.dataset.lang;
    });
  });

  // Restore saved contact info from storage
  if (chrome.storage && chrome.storage.local) {
    chrome.storage.local.get(["saved_citizen_name", "saved_citizen_phone"], (res) => {
      if (res.saved_citizen_name) {
        citizenName.value = res.saved_citizen_name;
        badgeName.className = "field-status-tag ai";
        badgeName.innerText = "Saved Profile";
      }
      if (res.saved_citizen_phone) {
        citizenPhone.value = res.saved_citizen_phone;
        badgePhone.className = "field-status-tag ai";
        badgePhone.innerText = "Saved Profile";
      }
    });
  }

  // Update badges on user input
  citizenName.addEventListener("input", () => {
    if (citizenName.value.trim().length > 0) {
      badgeName.className = "field-status-tag ai";
      badgeName.innerText = "Ready";
    } else {
      badgeName.className = "field-status-tag required";
      badgeName.innerText = "Required";
    }
  });

  citizenPhone.addEventListener("input", () => {
    if (citizenPhone.value.trim().length >= 10) {
      badgePhone.className = "field-status-tag ai";
      badgePhone.innerText = "Ready";
    } else {
      badgePhone.className = "field-status-tag required";
      badgePhone.innerText = "Required";
    }
  });

  editLoc.addEventListener("input", () => {
    if (editLoc.value.trim().length > 0) {
      badgeLoc.className = "field-status-tag ai";
      badgeLoc.innerText = "Ready";
    } else {
      badgeLoc.className = "field-status-tag required";
      badgeLoc.innerText = "Required";
    }
  });

  // 1. Inspect Active Tab Form
  function runFormInspection() {
    chrome.runtime.sendMessage({ action: "TRIGGER_INSPECT_PAGE" }, (res) => {
      if (res && res.supported && res.fields && res.fields.length > 0) {
        inspectorCard.classList.remove("hidden");
        const emptyCount = res.totalRequired - res.filledRequired;
        inspectorStatusText.innerText = `${res.portalName}: ${emptyCount} empty required field(s) on page.`;

        // Render pills
        pillbox.innerHTML = "";
        res.fields.forEach(f => {
          const pill = document.createElement("span");
          pill.className = `field-pill ${f.isFilled ? "filled" : ""}`;
          pill.innerText = `${f.label.split(" ")[0]}: ${f.isFilled ? "✓" : "empty"}`;
          pillbox.appendChild(pill);
        });
      }
    });
  }

  // Check Active Tab Portal Support
  function checkActiveTabSupport() {
    chrome.runtime.sendMessage({ action: "CHECK_ACTIVE_TAB_SUPPORT" }, (res) => {
      if (res && res.supported) {
        tabStatusBanner.className = "alert-banner info";
        tabStatusText.innerText = `Connected to: ${res.portalName}`;
        runFormInspection();
      } else {
        tabStatusBanner.className = "alert-banner warning";
        tabStatusText.innerHTML = `⚠️ Active tab is not a supported portal. <a href="http://localhost:8000/portal" target="_blank" style="text-decoration: underline; font-weight: bold; color: inherit;">Open Mock Portal</a>`;
      }
    });
  }

  checkActiveTabSupport();

  reinspectBtn.addEventListener("click", () => {
    runFormInspection();
  });

  // Voice Recognition (Web Speech API)
  let isRecording = false;
  let recognition = null;

  if ("webkitSpeechRecognition" in window || "SpeechRecognition" in window) {
    const SpeechRec = window.SpeechRecognition || window.webkitSpeechRecognition;
    recognition = new SpeechRec();
    recognition.continuous = false;
    recognition.interimResults = false;

    recognition.onstart = () => {
      isRecording = true;
      micBtn.classList.add("recording");
    };

    recognition.onend = () => {
      isRecording = false;
      micBtn.classList.remove("recording");
    };

    recognition.onerror = () => {
      isRecording = false;
      micBtn.classList.remove("recording");
    };

    recognition.onresult = (e) => {
      const transcript = e.results[0][0].transcript;
      rawInput.value = (rawInput.value ? rawInput.value + " " : "") + transcript;
    };
  }

  micBtn.addEventListener("click", () => {
    if (!recognition) {
      alert("Speech recognition not supported in this browser environment.");
      return;
    }
    if (isRecording) {
      recognition.stop();
    } else {
      recognition.lang = currentLang === "te" ? "te-IN" : (currentLang === "hi" ? "hi-IN" : "en-IN");
      recognition.start();
    }
  });

  // Quick Chips
  document.querySelectorAll(".chip").forEach(chip => {
    chip.addEventListener("click", () => {
      rawInput.value = chip.dataset.text;
    });
  });

  // Photo Input (Base64)
  photoInput.addEventListener("change", (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        photoBase64 = event.target.result;
        photoImg.src = photoBase64;
        photoPreview.classList.remove("hidden");
        if (photoStatusText) photoStatusText.innerText = `Attached: ${file.name} (${Math.round(file.size / 1024)} KB)`;
      };
      reader.readAsDataURL(file);
    }
  });

  removePhotoBtn.addEventListener("click", () => {
    photoBase64 = null;
    photoInput.value = "";
    photoPreview.classList.add("hidden");
    if (photoStatusText) photoStatusText.innerText = "No photo attached yet";
  });

  // GPS Location Detection
  detectGpsBtn.addEventListener("click", () => {
    if (!navigator.geolocation) {
      alert("Geolocation is not supported by your browser.");
      return;
    }

    detectGpsBtn.innerText = "Locating...";
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = pos.coords.latitude;
        const lon = pos.coords.longitude;
        fetch(`http://localhost:8000/api/v1/geocode/reverse?lat=${lat}&lon=${lon}`)
          .then(res => res.json())
          .then(data => {
            detectGpsBtn.innerText = "📍 GPS";
            if (data.display_name) {
              editLoc.value = data.display_name;
              badgeLoc.className = "field-status-tag ai";
              badgeLoc.innerText = "GPS Verified";
            } else {
              editLoc.value = `Lat ${lat.toFixed(4)}, Lon ${lon.toFixed(4)}`;
            }
          })
          .catch(() => {
            detectGpsBtn.innerText = "📍 GPS";
            editLoc.value = `Lat ${lat.toFixed(4)}, Lon ${lon.toFixed(4)}`;
          });
      },
      (err) => {
        detectGpsBtn.innerText = "📍 GPS";
        alert("Could not retrieve GPS coordinates: " + err.message);
      },
      { timeout: 7000 }
    );
  });

  // Analyze Complaint
  analyzeBtn.addEventListener("click", () => {
    const text = rawInput.value.trim();
    if (!text) return;

    analyzeBtn.disabled = true;
    analyzeBtn.querySelector(".btn-text").innerText = "Analyzing with Gemini...";
    analyzeBtn.querySelector(".spinner").classList.remove("hidden");

    privacyBanner.classList.add("hidden");
    confirmationCard.classList.add("hidden");
    handoffCard.classList.add("hidden");
    receiptCard.classList.add("hidden");

    chrome.runtime.sendMessage({
      action: "CALL_BACKEND_ANALYZE",
      payload: {
        raw_input: text,
        language: currentLang,
        image_base64: photoBase64
      }
    }, (response) => {
      analyzeBtn.disabled = false;
      analyzeBtn.querySelector(".btn-text").innerText = "Synthesize Complaint";
      analyzeBtn.querySelector(".spinner").classList.add("hidden");

      if (response && response.success && response.data) {
        synthesizedComplaint = response.data;

        // Privacy alert
        if (synthesizedComplaint.privacy_warning) {
          privacyBanner.classList.remove("hidden");
        }

        // Render Follow-up / Missing Fields Question
        if (synthesizedComplaint.follow_up_prompt) {
          followupText.innerText = synthesizedComplaint.follow_up_prompt;
          followupBox.classList.remove("hidden");
        } else if (synthesizedComplaint.missing_fields && synthesizedComplaint.missing_fields.length > 0) {
          followupText.innerText = `Please fill your ${synthesizedComplaint.missing_fields.join(", ")} below to complete registration.`;
          followupBox.classList.remove("hidden");
        } else {
          followupBox.classList.add("hidden");
        }

        // Populate fields
        confUrgency.innerText = `${synthesizedComplaint.urgency_level} URGENCY (${synthesizedComplaint.urgency_score}/10)`;
        confCategory.innerText = synthesizedComplaint.category;
        
        editDept.value = synthesizedComplaint.department;
        editCat.value = synthesizedComplaint.category;
        editUrgency.value = (synthesizedComplaint.urgency_level || "HIGH").toUpperCase();
        
        if (synthesizedComplaint.location_text && !synthesizedComplaint.location_text.toLowerCase().includes("pending")) {
          editLoc.value = synthesizedComplaint.location_text;
          badgeLoc.className = "field-status-tag ai";
          badgeLoc.innerText = "AI Extracted";
        }

        editDesc.value = synthesizedComplaint.description;

        confirmationCard.classList.remove("hidden");
        confirmationCard.scrollIntoView({ behavior: "smooth" });
        runFormInspection();
      } else {
        alert("Failed to analyze complaint. Please ensure JanSetu backend is running on port 8000.");
      }
    });
  });

  // Individual Field Fill Handlers
  document.querySelectorAll(".btn-single-fill").forEach(btn => {
    btn.addEventListener("click", () => {
      const key = btn.dataset.key;
      const label = btn.dataset.label;
      let val = "";

      if (key === "citizen_name") val = citizenName.value.trim();
      else if (key === "citizen_phone") val = citizenPhone.value.trim();
      else if (key === "department") val = editDept.value.trim();
      else if (key === "category") val = editCat.value.trim();
      else if (key === "urgency_level") val = editUrgency.value.trim();
      else if (key === "location") val = editLoc.value.trim();
      else if (key === "description") val = editDesc.value.trim();
      else if (key === "photo") val = photoBase64;

      if (!val && key !== "photo") {
        alert(`Please enter a value for ${label} before filling on the page.`);
        return;
      }

      btn.disabled = true;
      btn.innerText = "Filling...";

      chrome.runtime.sendMessage({
        action: "TRIGGER_SINGLE_FIELD_FILL",
        key: key,
        value: val,
        label: label
      }, (res) => {
        btn.disabled = false;
        if (res && res.success) {
          btn.innerText = "✓ Filled";
          btn.classList.add("done");
          setTimeout(() => {
            btn.innerText = "Fill ➔";
            btn.classList.remove("done");
          }, 2500);
          runFormInspection();
        } else {
          btn.innerText = "Fill ➔";
          alert(`Failed to fill ${label} on active tab. Ensure portal page is open.`);
        }
      });
    });
  });

  // Fill All Remaining Form Fields via In-Page Content Script
  fillPortalBtn.addEventListener("click", () => {
    if (!synthesizedComplaint) return;

    // Validate essential inputs
    if (!citizenName.value.trim()) {
      citizenName.focus();
      alert("Please enter Citizen Full Name before populating the form.");
      return;
    }

    if (!citizenPhone.value.trim()) {
      citizenPhone.focus();
      alert("Please enter Contact Mobile Number for SMS tracking.");
      return;
    }

    if (!editLoc.value.trim() || editLoc.value.toLowerCase().includes("pending")) {
      editLoc.focus();
      alert("Please specify the exact location/ward so municipal teams can respond.");
      return;
    }

    // Save profile for subsequent filings
    if (chrome.storage && chrome.storage.local) {
      chrome.storage.local.set({
        saved_citizen_name: citizenName.value.trim(),
        saved_citizen_phone: citizenPhone.value.trim()
      });
    }

    fillPortalBtn.disabled = true;
    fillPortalBtn.querySelector(".spinner").classList.remove("hidden");

    const payload = {
      citizen_name: citizenName.value.trim(),
      citizen_phone: citizenPhone.value.trim(),
      department: editDept.value.trim(),
      category: editCat.value.trim() || confCategory.innerText,
      urgency_level: editUrgency.value.trim(),
      location: editLoc.value.trim(),
      description: editDesc.value.trim(),
      photo_base64: photoBase64
    };

    chrome.runtime.sendMessage({
      action: "TRIGGER_CONTENT_FILL",
      formData: payload
    }, (res) => {
      fillPortalBtn.disabled = false;
      fillPortalBtn.querySelector(".spinner").classList.add("hidden");

      if (res && res.success) {
        runFormInspection();
        alert("✅ Form fields successfully populated on the municipal portal page! Please review and click 'Submit Grievance' on the page.");
      } else {
        // Guided Handoff Fallback
        confirmationCard.classList.add("hidden");
        hfDept.innerText = editDept.value;
        hfLoc.innerText = editLoc.value;
        hfDesc.innerText = editDesc.value;
        handoffCard.classList.remove("hidden");
      }
    });
  });

  // Copy Handoff Fields
  document.querySelectorAll(".copy-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      const targetId = btn.dataset.target;
      const val = document.getElementById(targetId).innerText;
      navigator.clipboard.writeText(val);
      btn.innerText = "Copied!";
      setTimeout(() => btn.innerText = "Copy", 1500);
    });
  });

  // Listen for Tracking ID detected by content script
  chrome.runtime.onMessage.addListener((message) => {
    if (message.action === "UPDATE_TRACKING_RECEIPT") {
      receiptTrackingId.innerText = message.trackingId;
      confirmationCard.classList.add("hidden");
      handoffCard.classList.add("hidden");
      receiptCard.classList.remove("hidden");
      receiptCard.scrollIntoView({ behavior: "smooth" });
    }
  });

  // TAB 2: Check Scheme Claim
  const checkClaimBtn = document.getElementById("check-claim-btn");
  const claimInput = document.getElementById("claim-input");
  const claimResult = document.getElementById("claim-result");
  const claimVerdict = document.getElementById("claim-verdict");
  const claimSummary = document.getElementById("claim-summary");
  const claimQuote = document.getElementById("claim-quote");
  const claimLink = document.getElementById("claim-link");

  checkClaimBtn.addEventListener("click", () => {
    const claim = claimInput.value.trim();
    if (!claim) return;

    checkClaimBtn.disabled = true;
    checkClaimBtn.innerText = "Verifying...";

    fetch("http://localhost:8000/api/v1/fact-check", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ claim: claim })
    })
      .then(res => res.json())
      .then(data => {
        checkClaimBtn.disabled = false;
        checkClaimBtn.innerText = "Verify Against Official Schemes";

        claimVerdict.innerText = data.verdict.toUpperCase();
        claimSummary.innerText = data.summary;
        claimQuote.innerText = `"${data.exact_source_text}"`;
        claimLink.href = data.official_source_url;

        claimResult.className = `result-box ${data.outcome}`;
        claimResult.classList.remove("hidden");
      })
      .catch(() => {
        checkClaimBtn.disabled = false;
        checkClaimBtn.innerText = "Verify Against Official Schemes";
        alert("Backend not reachable. Ensure FastAPI is running on port 8000.");
      });
  });

  // TAB 3: Escalations
  const generateEscBtn = document.getElementById("generate-esc-btn");
  const escTrackingId = document.getElementById("esc-tracking-id");
  const escResultContainer = document.getElementById("esc-result-container");
  const escSubject = document.getElementById("esc-subject");
  const escBody = document.getElementById("esc-body");
  const copyEscBtn = document.getElementById("copy-esc-btn");

  generateEscBtn.addEventListener("click", () => {
    const trackingId = escTrackingId.value.trim();
    if (!trackingId) return;

    const escType = document.querySelector('input[name="esc-type"]:checked').value;
    generateEscBtn.disabled = true;
    generateEscBtn.innerText = "Drafting Statutory Document...";

    fetch("http://localhost:8000/api/v1/escalate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        tracking_id: trackingId,
        escalation_type: escType,
        days_elapsed: 16
      })
    })
      .then(res => res.json())
      .then(data => {
        generateEscBtn.disabled = false;
        generateEscBtn.innerText = "Generate Statutory Draft";

        escSubject.innerText = data.subject_line;
        escBody.value = data.letter_body;
        escResultContainer.classList.remove("hidden");
      })
      .catch(() => {
        generateEscBtn.disabled = false;
        generateEscBtn.innerText = "Generate Statutory Draft";
        alert("Failed to draft escalation. Check if tracking ID exists.");
      });
  });

  copyEscBtn.addEventListener("click", () => {
    navigator.clipboard.writeText(escBody.value);
    copyEscBtn.innerText = "Copied to Clipboard!";
    setTimeout(() => copyEscBtn.innerText = "Copy Escalation to Clipboard", 2000);
  });
});
