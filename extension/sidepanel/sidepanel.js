/**
 * JanSetu Lite - Conversational One-by-One Civic Copilot
 * Features:
 * - Ultra-accessible one-question-at-a-time wizard
 * - Natural multilingual voice TTS (English, Hindi, Telugu)
 * - Speech-to-Text with spoken numbers normalization
 * - Real-time progressive form filling on the active portal tab
 * - GPS Reverse Geocoding
 * - Offline Fallback & Fact-Checking
 */
document.addEventListener("DOMContentLoaded", () => {
  let currentLang = "en";
  let voiceEnabled = true;
  let currentStep = 1;

  // Stored state for current grievance
  let complaintData = {
    problem_raw: "",
    department: "",
    category: "",
    urgency_level: "HIGH",
    urgency_score: 8,
    description: "",
    location: "",
    citizen_name: "",
    citizen_phone: "",
    photo_base64: null
  };

  // Dialog Prompts Dictionary
  const DIALOGS = {
    en: {
      q1: "What problem are you facing? Tell me what happened in simple words.",
      q1_confirm: (dept) => `Got it. I have classified this under ${dept} with high urgency and filled it on the portal.`,
      q2: "Where did this problem happen? Tell me your street name, colony, or tap the GPS button.",
      q3: "What is your full name? The municipal department needs your name for the file.",
      q4: "What is your 10-digit mobile number for official SMS updates?",
      q5: "Do you have a photo of the damage? You can choose a photo or skip.",
      q6: "All done! Every detail has been filled on the municipal portal page. Please look at the screen and click the blue Submit Grievance button to finish.",
      location_saved: "Location recorded and updated on portal.",
      name_saved: (name) => `Thank you, ${name}. Filled on portal.`,
      phone_saved: "Phone number saved and filled on portal.",
      photo_saved: "Photo evidence attached to portal.",
      step_labels: ["The Problem", "The Location", "Your Name", "Phone Number", "Photo Proof", "Review & Submit"]
    },
    hi: {
      q1: "नमस्ते! आपको क्या समस्या आ रही है? कृपया सरल शब्दों में बताइए।",
      q1_confirm: (dept) => `समझ गया। मैंने इसे ${dept} के अंतर्गत दर्ज कर दिया है।`,
      q2: "यह समस्या कहाँ हुई है? अपनी कॉलोनी या गली का नाम बताइए या जीपीएस बटन दबाएं।",
      q3: "आपका पूरा नाम क्या है?",
      q4: "स्टेटस अपडेट के लिए आपका 10 अंकों का मोबाइल नंबर क्या है?",
      q5: "क्या आपके पास समस्या की तस्वीर है? आप फोटो चुन सकते हैं या छोड़ सकते हैं।",
      q6: "बहुत बढ़िया! सारे विवरण पोर्टल पर भर दिए गए हैं। कृपया स्क्रीन पर सबमिट बटन दबाएं।",
      location_saved: "स्थान दर्ज हो गया है।",
      name_saved: (name) => `धन्यवाद, ${name} जी।`,
      phone_saved: "मोबाइल नंबर दर्ज हो गया है।",
      photo_saved: "फोटो प्रमाण जोड़ दिया गया है।",
      step_labels: ["समस्या", "स्थान", "आपका नाम", "मोबाइल नंबर", "फोटो प्रमाण", "जांच और सबमिट"]
    },
    te: {
      q1: "నమస్కారం! మీకు ఎలాంటి సమస్య ఎదురవుతోంది? వివరంగా చెప్పండి.",
      q1_confirm: (dept) => `అర్థమైంది. దీనిని ${dept} విభాగానికి జోడించి పోర్టల్‌లో నింపాను.`,
      q2: "ఈ సమస్య ఎక్కడ జరిగింది? మీ వీధి లేదా ప్రాంతం పేరు చెప్పండి.",
      q3: "మీ పూర్తి పేరు ఏమిటి?",
      q4: "ఎస్ఎమ్ఎస్ అప్‌డేట్‌ల కోసం మీ 10 అంకెల మొబైల్ నంబర్ చెప్పండి.",
      q5: "సమస్యకు సంబంధించిన ఫోటో ఉందా? మీరు ఫోటోను ఎంచుకోవచ్చు లేదా దాటవేయవచ్చు.",
      q6: "అన్ని వివరాలు మున్సిపల్ పోర్టల్‌లో నింపబడ్డాయి. దయచేసి స్క్రీన్‌పై ఉన్న సబ్మిట్ బటన్ నొక్కండి.",
      location_saved: "లొకేషన్ నమోదు చేయబడింది.",
      name_saved: (name) => `ధన్యవాదాలు, ${name} గారు.`,
      phone_saved: "ఫోన్ నంబర్ నమోదు చేయబడింది.",
      photo_saved: "ఫోటో జోడించబడింది.",
      step_labels: ["సమస్య", "లొకేషన్", "మీ పేరు", "మొబైల్ నంబర్", "ఫోటో రుజువు", "సమీక్ష & సబ్మిట్"]
    }
  };

  // DOM Elements - Voice & Language
  const voiceToggleBtn = document.getElementById("voice-toggle-btn");
  const voiceIcon = document.getElementById("voice-icon");
  const voiceStatus = document.getElementById("voice-status");
  const speakingIndicator = document.getElementById("speaking-indicator");
  const speakingText = document.getElementById("speaking-text");

  // DOM Elements - Progress
  const progressStepLabel = document.getElementById("progress-step-label");
  const progressStepCount = document.getElementById("progress-step-count");
  const progressBar = document.getElementById("progress-bar");

  // DOM Elements - Steps
  const step1 = document.getElementById("wizard-step-1");
  const step2 = document.getElementById("wizard-step-2");
  const step3 = document.getElementById("wizard-step-3");
  const step4 = document.getElementById("wizard-step-4");
  const step5 = document.getElementById("wizard-step-5");
  const step6 = document.getElementById("wizard-step-6");
  const receiptCard = document.getElementById("receipt-card");
  const receiptTrackingId = document.getElementById("receipt-tracking-id");
  const privacyBanner = document.getElementById("privacy-banner");

  // Step 1 Inputs & Controls
  const inputProblem = document.getElementById("input-problem");
  const micBtnStep1 = document.getElementById("mic-btn-step1");
  const btnNextStep1 = document.getElementById("btn-next-step1");

  // Step 2 Inputs & Controls
  const inputLocation = document.getElementById("input-location");
  const micBtnStep2 = document.getElementById("mic-btn-step2");
  const btnGpsDetect = document.getElementById("btn-gps-detect");
  const gpsBtnText = document.getElementById("gps-btn-text");
  const btnBackStep2 = document.getElementById("btn-back-step2");
  const btnNextStep2 = document.getElementById("btn-next-step2");

  // Step 3 Inputs & Controls
  const inputName = document.getElementById("input-name");
  const micBtnStep3 = document.getElementById("mic-btn-step3");
  const savedNameContainer = document.getElementById("saved-name-container");
  const savedNameText = document.getElementById("saved-name-text");
  const btnUseSavedName = document.getElementById("btn-use-saved-name");
  const btnBackStep3 = document.getElementById("btn-back-step3");
  const btnNextStep3 = document.getElementById("btn-next-step3");

  // Step 4 Inputs & Controls
  const inputPhone = document.getElementById("input-phone");
  const micBtnStep4 = document.getElementById("mic-btn-step4");
  const savedPhoneContainer = document.getElementById("saved-phone-container");
  const savedPhoneText = document.getElementById("saved-phone-text");
  const btnUseSavedPhone = document.getElementById("btn-use-saved-phone");
  const btnBackStep4 = document.getElementById("btn-back-step4");
  const btnNextStep4 = document.getElementById("btn-next-step4");

  // Step 5 Inputs & Controls
  const inputPhoto = document.getElementById("input-photo");
  const photoPreviewBox = document.getElementById("photo-preview-box");
  const photoPreviewImg = document.getElementById("photo-preview-img");
  const btnRemovePhoto = document.getElementById("btn-remove-photo");
  const btnBackStep5 = document.getElementById("btn-back-step5");
  const btnSkipPhoto = document.getElementById("btn-skip-photo");
  const btnNextStep5 = document.getElementById("btn-next-step5");

  // Step 6 Review Elements
  const revDept = document.getElementById("rev-dept");
  const revCat = document.getElementById("rev-cat");
  const revUrgency = document.getElementById("rev-urgency");
  const revLoc = document.getElementById("rev-loc");
  const revName = document.getElementById("rev-name");
  const revPhone = document.getElementById("rev-phone");
  const btnRestartWizard = document.getElementById("btn-restart-wizard");

  // ----------------------------------------------------------------
  // Speech Synthesis (Text-to-Speech)
  // ----------------------------------------------------------------
  function speak(text) {
    if (!voiceEnabled || !("speechSynthesis" in window)) return;
    
    window.speechSynthesis.cancel(); // Stop any pending speech
    const utterance = new SpeechSynthesisUtterance(text);
    
    // Choose appropriate voice
    const voices = window.speechSynthesis.getVoices();
    const langCode = currentLang === "te" ? "te-IN" : (currentLang === "hi" ? "hi-IN" : "en-IN");
    utterance.lang = langCode;
    utterance.rate = 0.95; // Slightly slower for clear municipal comprehension
    utterance.pitch = 1.0;

    const matchedVoice = voices.find(v => v.lang.startsWith(currentLang) || v.lang.includes(langCode));
    if (matchedVoice) utterance.voice = matchedVoice;

    speakingIndicator.classList.remove("hidden");
    speakingText.innerText = `JanSetu speaking: "${text.length > 50 ? text.substring(0, 48) + '...' : text}"`;

    utterance.onend = () => {
      speakingIndicator.classList.add("hidden");
    };

    utterance.onerror = () => {
      speakingIndicator.classList.add("hidden");
    };

    window.speechSynthesis.speak(utterance);
  }

  // Voice Toggle Button
  voiceToggleBtn.addEventListener("click", () => {
    voiceEnabled = !voiceEnabled;
    if (voiceEnabled) {
      voiceToggleBtn.classList.remove("muted");
      voiceIcon.innerText = "🔊";
      voiceStatus.innerText = "Voice ON";
      speak(DIALOGS[currentLang][`q${currentStep}`] || "Voice enabled.");
    } else {
      window.speechSynthesis.cancel();
      voiceToggleBtn.classList.add("muted");
      voiceIcon.innerText = "🔇";
      voiceStatus.innerText = "Voice OFF";
      speakingIndicator.classList.add("hidden");
    }
  });

  // Language Selector
  document.querySelectorAll(".lang-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".lang-btn").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      currentLang = btn.dataset.lang;
      speak(DIALOGS[currentLang][`q${currentStep}`]);
    });
  });

  // ----------------------------------------------------------------
  // Speech Recognition (Speech-to-Text)
  // ----------------------------------------------------------------
  function setupSpeechRecognition(buttonEl, targetInputEl, isPhone = false) {
    if (!("webkitSpeechRecognition" in window || "SpeechRecognition" in window)) {
      buttonEl.style.display = "none";
      return;
    }

    const SpeechRec = window.SpeechRecognition || window.webkitSpeechRecognition;
    const recognition = new SpeechRec();
    recognition.continuous = false;
    recognition.interimResults = false;

    let isRecording = false;

    recognition.onstart = () => {
      isRecording = true;
      buttonEl.classList.add("recording");
      buttonEl.querySelector(".mic-label").innerText = "Listening...";
    };

    recognition.onend = () => {
      isRecording = false;
      buttonEl.classList.remove("recording");
      buttonEl.querySelector(".mic-label").innerText = "Tap to Speak";
    };

    recognition.onerror = () => {
      isRecording = false;
      buttonEl.classList.remove("recording");
      buttonEl.querySelector(".mic-label").innerText = "Tap to Speak";
    };

    recognition.onresult = (e) => {
      let transcript = e.results[0][0].transcript;
      if (isPhone) {
        transcript = normalizeSpokenNumbers(transcript);
      }
      targetInputEl.value = transcript.trim();
      targetInputEl.dispatchEvent(new Event("input", { bubbles: true }));
    };

    buttonEl.addEventListener("click", () => {
      if (isRecording) {
        recognition.stop();
      } else {
        recognition.lang = currentLang === "te" ? "te-IN" : (currentLang === "hi" ? "hi-IN" : "en-IN");
        recognition.start();
      }
    });
  }

  // Normalizes spoken numbers ("nine eight seven six...") to digits
  function normalizeSpokenNumbers(text) {
    const wordMap = {
      zero: "0", one: "1", two: "2", three: "3", four: "4",
      five: "5", six: "6", seven: "7", eight: "8", nine: "9",
      shunya: "0", ek: "1", do: "2", teen: "3", chaar: "4",
      paanch: "5", chhah: "6", saat: "7", aath: "8", nau: "9"
    };
    let clean = text.toLowerCase().replace(/double\s+(\w+)/g, "$1 $1").replace(/triple\s+(\w+)/g, "$1 $1 $1");
    let result = "";
    clean.split(/[\s-]+/).forEach(token => {
      if (wordMap[token]) result += wordMap[token];
      else if (/^\d+$/.test(token)) result += token;
    });
    return result || text.replace(/\D/g, "");
  }

  setupSpeechRecognition(micBtnStep1, inputProblem);
  setupSpeechRecognition(micBtnStep2, inputLocation);
  setupSpeechRecognition(micBtnStep3, inputName);
  setupSpeechRecognition(micBtnStep4, inputPhone, true);

  // ----------------------------------------------------------------
  // Saved Profile Restoration
  // ----------------------------------------------------------------
  if (chrome.storage && chrome.storage.local) {
    chrome.storage.local.get(["saved_citizen_name", "saved_citizen_phone"], (res) => {
      if (res.saved_citizen_name) {
        savedNameText.innerText = `Use: "${res.saved_citizen_name}"`;
        savedNameContainer.classList.remove("hidden");
        btnUseSavedName.onclick = () => {
          inputName.value = res.saved_citizen_name;
        };
      }
      if (res.saved_citizen_phone) {
        savedPhoneText.innerText = `Use: "${res.saved_citizen_phone}"`;
        savedPhoneContainer.classList.remove("hidden");
        btnUseSavedPhone.onclick = () => {
          inputPhone.value = res.saved_citizen_phone;
        };
      }
    });
  }

  // Quick Chips
  document.querySelectorAll(".chip").forEach(chip => {
    chip.addEventListener("click", () => {
      inputProblem.value = chip.dataset.text;
    });
  });

  // Photo Upload Handler
  inputPhoto.addEventListener("change", (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        complaintData.photo_base64 = event.target.result;
        photoPreviewImg.src = complaintData.photo_base64;
        photoPreviewBox.classList.remove("hidden");
      };
      reader.readAsDataURL(file);
    }
  });

  btnRemovePhoto.addEventListener("click", () => {
    complaintData.photo_base64 = null;
    inputPhoto.value = "";
    photoPreviewBox.classList.add("hidden");
  });

  // GPS Location Handler
  btnGpsDetect.addEventListener("click", () => {
    if (!navigator.geolocation) {
      alert("Geolocation is not supported in this browser.");
      return;
    }
    gpsBtnText.innerText = "Finding GPS Location...";
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = pos.coords.latitude;
        const lon = pos.coords.longitude;
        fetch(`http://localhost:8000/api/v1/geocode/reverse?lat=${lat}&lon=${lon}`)
          .then(res => res.json())
          .then(data => {
            gpsBtnText.innerText = "📍 Auto-Detect My Current GPS Location";
            inputLocation.value = data.display_name || `Lat ${lat.toFixed(4)}, Lon ${lon.toFixed(4)}`;
            speak(DIALOGS[currentLang].location_saved);
          })
          .catch(() => {
            gpsBtnText.innerText = "📍 Auto-Detect My Current GPS Location";
            inputLocation.value = `Lat ${lat.toFixed(4)}, Lon ${lon.toFixed(4)}`;
          });
      },
      (err) => {
        gpsBtnText.innerText = "📍 Auto-Detect My Current GPS Location";
        alert("GPS detection error: " + err.message);
      },
      { timeout: 8000 }
    );
  });

  // ----------------------------------------------------------------
  // Wizard Navigation & State Machine
  // ----------------------------------------------------------------
  function showStep(stepNum) {
    currentStep = stepNum;
    [step1, step2, step3, step4, step5, step6].forEach((el, idx) => {
      if (idx + 1 === stepNum) el.classList.add("active");
      else el.classList.remove("active");
    });

    const labels = DIALOGS[currentLang].step_labels;
    progressStepLabel.innerText = `Step ${stepNum}: ${labels[stepNum - 1] || 'Complete'}`;
    progressStepCount.innerText = `${stepNum} of 5`;
    progressBar.style.width = `${Math.min(stepNum * 20, 100)}%`;

    // Speak Question for the new step
    const questionText = DIALOGS[currentLang][`q${stepNum}`];
    if (questionText) {
      setTimeout(() => speak(questionText), 200);
    }
  }

  // Initial welcome speech on load
  setTimeout(() => speak(DIALOGS[currentLang].q1), 600);

  // STEP 1 -> STEP 2: Analyze problem and auto-fill Department, Category, Urgency, Description
  btnNextStep1.addEventListener("click", () => {
    const text = inputProblem.value.trim();
    if (!text) {
      alert("Please tell or type what problem you are facing.");
      return;
    }

    btnNextStep1.disabled = true;
    btnNextStep1.querySelector(".btn-text").innerText = "Analyzing with Gemini...";
    btnNextStep1.querySelector(".spinner").classList.remove("hidden");

    complaintData.problem_raw = text;

    chrome.runtime.sendMessage({
      action: "CALL_BACKEND_ANALYZE",
      payload: {
        raw_input: text,
        language: currentLang
      }
    }, (res) => {
      btnNextStep1.disabled = false;
      btnNextStep1.querySelector(".btn-text").innerText = "Analyze & Continue ➔";
      btnNextStep1.querySelector(".spinner").classList.add("hidden");

      if (res && res.success && res.data) {
        const d = res.data;
        complaintData.department = d.department;
        complaintData.category = d.category;
        complaintData.urgency_level = d.urgency_level;
        complaintData.urgency_score = d.urgency_score;
        complaintData.description = d.description;

        // Privacy Warning
        if (d.privacy_warning) {
          privacyBanner.classList.remove("hidden");
        }

        // Pre-fill location if Gemini found it
        if (d.location_text && !d.location_text.toLowerCase().includes("pending")) {
          inputLocation.value = d.location_text;
        }

        // Live Fill fields onto Portal page!
        chrome.runtime.sendMessage({
          action: "TRIGGER_FILL_FIELDS",
          fields: {
            department: d.department,
            category: d.category,
            urgency_level: d.urgency_level,
            description: d.description
          }
        });

        // Speak Confirmation
        speak(DIALOGS[currentLang].q1_confirm(d.department));

        // Advance to Step 2
        setTimeout(() => showStep(2), 1200);
      } else {
        alert("Could not reach JanSetu backend. Ensure port 8000 is running.");
      }
    });
  });

  // STEP 2 -> STEP 3: Location
  btnBackStep2.addEventListener("click", () => showStep(1));
  btnNextStep2.addEventListener("click", () => {
    const loc = inputLocation.value.trim();
    if (!loc) {
      alert("Please specify the street name, colony, or tap GPS so municipal officers know where to go.");
      return;
    }

    complaintData.location = loc;

    // Live Fill onto portal
    chrome.runtime.sendMessage({
      action: "TRIGGER_SINGLE_FIELD_FILL",
      key: "location",
      value: loc,
      label: "Location"
    });

    speak(DIALOGS[currentLang].location_saved);
    setTimeout(() => showStep(3), 600);
  });

  // STEP 3 -> STEP 4: Citizen Name
  btnBackStep3.addEventListener("click", () => showStep(2));
  btnNextStep3.addEventListener("click", () => {
    const name = inputName.value.trim();
    if (!name) {
      alert("Please enter your name so the department can register your complaint.");
      return;
    }

    complaintData.citizen_name = name;

    // Save profile locally
    if (chrome.storage && chrome.storage.local) {
      chrome.storage.local.set({ saved_citizen_name: name });
    }

    // Live Fill onto portal
    chrome.runtime.sendMessage({
      action: "TRIGGER_SINGLE_FIELD_FILL",
      key: "citizen_name",
      value: name,
      label: "Citizen Name"
    });

    speak(DIALOGS[currentLang].name_saved(name));
    setTimeout(() => showStep(4), 600);
  });

  // STEP 4 -> STEP 5: Phone Number
  btnBackStep4.addEventListener("click", () => showStep(3));
  btnNextStep4.addEventListener("click", () => {
    const rawDigits = inputPhone.value.replace(/\D/g, "");
    if (rawDigits.length < 10) {
      alert("Please enter a valid 10-digit mobile number for official SMS updates.");
      return;
    }

    complaintData.citizen_phone = rawDigits.slice(-10);

    // Save profile locally
    if (chrome.storage && chrome.storage.local) {
      chrome.storage.local.set({ saved_citizen_phone: complaintData.citizen_phone });
    }

    // Live Fill onto portal
    chrome.runtime.sendMessage({
      action: "TRIGGER_SINGLE_FIELD_FILL",
      key: "citizen_phone",
      value: complaintData.citizen_phone,
      label: "Contact Phone"
    });

    speak(DIALOGS[currentLang].phone_saved);
    setTimeout(() => showStep(5), 600);
  });

  // STEP 5 -> STEP 6: Photo Evidence & Review
  btnBackStep5.addEventListener("click", () => showStep(4));
  
  function finalizeToStep6() {
    // Fill photo if present
    if (complaintData.photo_base64) {
      chrome.runtime.sendMessage({
        action: "TRIGGER_SINGLE_FIELD_FILL",
        key: "photo",
        value: complaintData.photo_base64,
        label: "Photo Evidence"
      });
    }

    // Render Review Card
    revDept.innerText = complaintData.department;
    revCat.innerText = complaintData.category;
    revUrgency.innerText = `${complaintData.urgency_level} (${complaintData.urgency_score}/10)`;
    revLoc.innerText = complaintData.location;
    revName.innerText = complaintData.citizen_name;
    revPhone.innerText = complaintData.citizen_phone;

    showStep(6);
  }

  btnSkipPhoto.addEventListener("click", finalizeToStep6);
  btnNextStep5.addEventListener("click", finalizeToStep6);

  // Restart Wizard
  btnRestartWizard.addEventListener("click", () => {
    inputProblem.value = "";
    inputLocation.value = "";
    complaintData.photo_base64 = null;
    inputPhoto.value = "";
    photoPreviewBox.classList.add("hidden");
    receiptCard.classList.add("hidden");
    showStep(1);
  });

  // ----------------------------------------------------------------
  // Official Receipt Detection from Portal DOM
  // ----------------------------------------------------------------
  chrome.runtime.onMessage.addListener((message) => {
    if (message.action === "UPDATE_TRACKING_RECEIPT") {
      receiptTrackingId.innerText = message.trackingId;
      step6.classList.remove("active");
      receiptCard.classList.remove("hidden");
      receiptCard.scrollIntoView({ behavior: "smooth" });
      speak(`Congratulations! Your grievance has been registered with tracking reference ${message.trackingId}`);
    }
  });

  // View Escalations Shortcut
  const btnViewEscalations = document.getElementById("btn-view-escalations");
  if (btnViewEscalations) {
    btnViewEscalations.addEventListener("click", () => {
      document.querySelectorAll(".tab-btn").forEach(b => b.classList.remove("active"));
      document.querySelectorAll(".tab-content").forEach(c => c.classList.remove("active"));
      document.querySelector('[data-target="tab-escalate"]').classList.add("active");
      document.getElementById("tab-escalate").classList.add("active");
      document.getElementById("esc-tracking-id").value = receiptTrackingId.innerText;
    });
  }

  // ----------------------------------------------------------------
  // TAB 2: Check Scheme Claim
  // ----------------------------------------------------------------
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

        claimResult.classList.remove("hidden");
        speak(`Verification result: ${data.verdict}. ${data.summary}`);
      })
      .catch(() => {
        checkClaimBtn.disabled = false;
        checkClaimBtn.innerText = "Verify Against Official Schemes";
        alert("Backend not reachable. Ensure FastAPI is running on port 8000.");
      });
  });

  // ----------------------------------------------------------------
  // TAB 3: Escalations
  // ----------------------------------------------------------------
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
        speak("Statutory escalation draft ready. You can copy it to clipboard.");
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
    setTimeout(() => copyEscBtn.innerText = "📋 Copy Escalation to Clipboard", 2000);
  });
});
