/**
 * JanSetu Lite Side Panel Logic
 */
document.addEventListener("DOMContentLoaded", () => {
  let currentLang = "en";
  let photoBase64 = null;
  let synthesizedComplaint = null;

  // DOM Elements
  const rawInput = document.getElementById("raw-input");
  const micBtn = document.getElementById("mic-btn");
  const photoInput = document.getElementById("photo-input");
  const photoPreview = document.getElementById("photo-preview");
  const photoImg = document.getElementById("photo-img");
  const removePhotoBtn = document.getElementById("remove-photo");
  const analyzeBtn = document.getElementById("analyze-btn");
  
  const privacyBanner = document.getElementById("privacy-banner");
  const tabStatusBanner = document.getElementById("tab-status-banner");
  const tabStatusText = document.getElementById("tab-status-text");

  const confirmationCard = document.getElementById("confirmation-card");
  const confUrgency = document.getElementById("conf-urgency");
  const confCategory = document.getElementById("conf-category");
  const editDept = document.getElementById("edit-department");
  const editLoc = document.getElementById("edit-location");
  const editDesc = document.getElementById("edit-description");
  const citizenName = document.getElementById("citizen-name");
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

  // Check Active Tab Portal Support
  function checkActiveTabSupport() {
    chrome.runtime.sendMessage({ action: "CHECK_ACTIVE_TAB_SUPPORT" }, (res) => {
      if (res && res.supported) {
        tabStatusBanner.className = "alert-banner info";
        tabStatusText.innerText = `Connected to: ${res.portalName}`;
      } else {
        tabStatusBanner.className = "alert-banner warning";
        tabStatusText.innerHTML = `⚠️ Active tab is not a supported portal. <a href="http://localhost:8000/portal" target="_blank" style="text-decoration: underline; font-weight: bold; color: inherit;">Open Mock Portal</a>`;
      }
    });
  }

  checkActiveTabSupport();

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
      };
      reader.readAsDataURL(file);
    }
  });

  removePhotoBtn.addEventListener("click", () => {
    photoBase64 = null;
    photoInput.value = "";
    photoPreview.classList.add("hidden");
  });

  // Analyze Complaint
  analyzeBtn.addEventListener("click", () => {
    const text = rawInput.value.trim();
    if (!text) return;

    analyzeBtn.disabled = true;
    analyzeBtn.querySelector(".btn-text").innerText = "Analyzing...";
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

        // Render Confirmation Card
        confUrgency.innerText = `${synthesizedComplaint.urgency_level} URGENCY (${synthesizedComplaint.urgency_score}/10)`;
        confCategory.innerText = synthesizedComplaint.category;
        editDept.value = synthesizedComplaint.department;
        editLoc.value = synthesizedComplaint.location_text || "";
        editDesc.value = synthesizedComplaint.description;

        confirmationCard.classList.remove("hidden");
        confirmationCard.scrollIntoView({ behavior: "smooth" });
      } else {
        alert("Failed to analyze complaint. Please ensure JanSetu backend is running on port 8000.");
      }
    });
  });

  // Fill Portal Form via In-Page Content Script
  fillPortalBtn.addEventListener("click", () => {
    if (!synthesizedComplaint) return;

    fillPortalBtn.disabled = true;
    fillPortalBtn.querySelector(".spinner").classList.remove("hidden");

    const payload = {
      citizen_name: citizenName.value || "Ananya Rao",
      citizen_phone: "9876543210",
      department: editDept.value,
      category: confCategory.innerText,
      urgency_level: synthesizedComplaint.urgency_level,
      location: editLoc.value,
      description: editDesc.value,
      photo_base64: photoBase64
    };

    chrome.runtime.sendMessage({
      action: "TRIGGER_CONTENT_FILL",
      formData: payload
    }, (res) => {
      fillPortalBtn.disabled = false;
      fillPortalBtn.querySelector(".spinner").classList.add("hidden");

      if (res && res.success) {
        // Form filled on portal tab! Citizen can now click submit.
        alert("Form fields populated on portal page! Please verify and click Submit on the portal.");
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
