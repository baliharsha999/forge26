/**
 * Nagarik AI - Conversational Civic Copilot
 * "Empowering Every Citizen"
 * 
 * Features:
 * - Animated Nagarik AI Mandala Reasoning Stage
 * - Ultra-accessible one-question-at-a-time wizard
 * - Multilingual natural speech (English, Hindi, Telugu)
 * - Progressive live portal DOM auto-filling
 * - GPS Reverse Geocoding via OpenStreetMap
 * - Speech-to-digits parser
 */
document.addEventListener("DOMContentLoaded", () => {
  let currentLang = "en";
  let voiceEnabled = true;
  let currentStep = 1;
  let reasoningInterval = null;

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
      q1_confirm: (dept) => `Got it. I have classified this under ${dept} with high urgency.`,
      q2: "Where did this problem happen? Tell me your city, station, branch, or tap GPS.",
      q3: "What is your full name? Official records require your legal name for the petition.",
      q4: "What is your 10-digit mobile number for official SMS updates?",
      q5: "Do you have a supporting photo or document? You can choose a file or skip.",
      q6: "All done! Every detail has been processed. Please verify and click Submit on the webpage to finish.",
      location_saved: "Location recorded and updated.",
      name_saved: (name) => `Thank you, ${name}. Saved for your petition.`,
      phone_saved: "Phone number saved for official SMS updates.",
      photo_saved: "Evidence attached to petition.",
      step_labels: ["The Problem", "Location / Ref", "Your Name", "Phone Number", "Photo Proof", "Review & Submit"]
    },
    hi: {
      q1: "नमस्ते! आपको क्या समस्या आ रही है? कृपया सरल शब्दों में बताइए।",
      q1_confirm: (dept) => `समझ गया। मैंने इसे ${dept} के अंतर्गत वर्गीकृत कर दिया है।`,
      q2: "यह समस्या कहाँ हुई है? अपना शहर, स्टेशन, या शाखा का नाम बताइए या जीपीएस बटन दबाएं।",
      q3: "आपका पूरा कानूनी नाम क्या है?",
      q4: "स्टेटस अपडेट के लिए आपका 10 अंकों का मोबाइल नंबर क्या है?",
      q5: "क्या आपके पास कोई फोटो या दस्तावेज प्रमाण है? आप चुन सकते हैं या छोड़ सकते हैं।",
      q6: "बहुत बढ़िया! सारे विवरण तैयार कर दिए गए हैं। कृपया स्क्रीन पर सबमिट बटन दबाएं।",
      location_saved: "स्थान दर्ज हो गया है।",
      name_saved: (name) => `धन्यवाद, ${name} जी।`,
      phone_saved: "मोबाइल नंबर दर्ज हो गया है।",
      photo_saved: "फोटो प्रमाण जोड़ दिया गया है।",
      step_labels: ["समस्या", "स्थान", "आपका नाम", "मोबाइल नंबर", "फोटो प्रमाण", "जांच और सबमिट"]
    },
    te: {
      q1: "నమస్కారం! మీకు ఎలాంటి సమస్య ఎదురవుతోంది? వివరంగా చెప్పండి.",
      q1_confirm: (dept) => `అర్థమైంది. దీనిని ${dept} విభాగానికి వర్గీకరించాను.`,
      q2: "ఈ సమస్య ఎక్కడ జరిగింది? మీ నగరం, స్టేషన్, లేదా ప్రాంతం చెప్పండి.",
      q3: "మీ పూర్తి పేరు ఏమిటి?",
      q4: "ఎస్ఎమ్ఎస్ అప్‌డేట్‌ల కోసం మీ 10 అంకెల మొబైల్ నంబర్ చెప్పండి.",
      q5: "సమస్యకు సంబంధించిన ఫోటో లేదా పత్రం ఉందా? మీరు ఎంచుకోవచ్చు లేదా దాటవేయవచ్చు.",
      q6: "అన్ని వివరాలు సిద్ధం చేయబడ్డాయి. దయచేసి స్క్రీన్‌పై ఉన్న సబ్మిట్ బటన్ నొక్కండి.",
      location_saved: "లొకేషన్ నమోదు చేయబడింది.",
      name_saved: (name) => `ధన్యవాదాలు, ${name} గారు.`,
      phone_saved: "ఫోన్ నంబర్ నమోదు చేయబడింది.",
      photo_saved: "ఫోటో జోడించబడింది.",
      step_labels: ["సమస్య", "లొకేషన్", "మీ పేరు", "మొబైల్ నంబర్", "ఫోటో రుజువు", "సమీక్ష & సబ్మిట్"]
    }
  };

  // AI Reasoning Steps for Animated Stage
  const REASONING_STEPS = {
    en: [
      "🧠 Nagarik AI is understanding your grievance...",
      "🏛️ Identifying responsible ministry & authority...",
      "⚖️ Mapping applicable citizen charters & statutory rules...",
      "⚡ Assessing urgency priority & immediate remedy...",
      "📝 Generating formal legal petition wording...",
      "🤖 Preparing live portal form injection..."
    ],
    hi: [
      "🧠 नागरिक एआई आपकी शिकायत का विश्लेषण कर रहा है...",
      "🏛️ संबंधित मंत्रालय एवं विभाग की पहचान की जा रही है...",
      "⚖️ लागू नागरिक चार्टर और नियमों का मिलान हो रहा है...",
      "⚡ तात्कालिकता और समाधान तैयार किया जा रहा है...",
      "🤖 पोर्टल फॉर्म में लाइव ऑटो-फिल की तैयारी हो रही है..."
    ],
    te: [
      "🧠 నాగరిక్ AI మీ సమస్యను విశ్లేషిస్తోంది...",
      "🏛️ సంబంధిత శాఖను గుర్తిస్తోంది...",
      "⚖️ చట్టపరమైన నిబంధనలను పరిశీలిస్తోంది...",
      "⚡ అత్యవసర స్థాయిని అంచనా వేస్తోంది...",
      "🤖 పోర్టల్ ఫారమ్‌లో లైవ్ ఆటో-ఫిల్ చేస్తోంది..."
    ]
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

  // DOM Elements - Animated Analyzing Stage
  const analyzingStage = document.getElementById("analyzing-stage");
  const mandalaSpinner = document.getElementById("mandala-spinner");
  const analyzingTitle = document.getElementById("analyzing-title");
  const reasoningTicker = document.getElementById("reasoning-ticker");

  // DOM Elements - Tab Connection & Status
  const tabStatusBanner = document.getElementById("tab-status-banner");
  const tabStatusText = document.getElementById("tab-status-text");
  const tabStatusBadge = document.getElementById("tab-status-badge");
  const q1Sub = document.getElementById("q1-sub");
  const q2Sub = document.getElementById("q2-sub");

  // DOM Elements - Steps
  const step1 = document.getElementById("wizard-step-1");
  const step2 = document.getElementById("wizard-step-2");
  const step3 = document.getElementById("wizard-step-3");
  const step4 = document.getElementById("wizard-step-4");
  const step5 = document.getElementById("wizard-step-5");
  const step6 = document.getElementById("wizard-step-6");
  const step6Icon = document.getElementById("step6-icon");
  const step6Title = document.getElementById("step6-title");
  const step6Subtitle = document.getElementById("step6-subtitle");
  const step6ActionBox = document.getElementById("step6-action-box");
  const step6ActionIcon = document.getElementById("step6-action-icon");
  const step6ActionTitle = document.getElementById("step6-action-title");
  const step6ActionText = document.getElementById("step6-action-text");
  const btnInjectNow = document.getElementById("btn-inject-now");
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
  const btnNewAfterReceipt = document.getElementById("btn-new-after-receipt");

  // ----------------------------------------------------------------
  // Speech Synthesis (Text-to-Speech)
  // ----------------------------------------------------------------
  function speak(text) {
    if (!voiceEnabled || !("speechSynthesis" in window)) return;
    
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    const langCode = currentLang === "te" ? "te-IN" : (currentLang === "hi" ? "hi-IN" : "en-IN");
    utterance.lang = langCode;
    utterance.rate = 0.95;
    utterance.pitch = 1.0;

    const voices = window.speechSynthesis.getVoices();
    const matchedVoice = voices.find(v => v.lang.startsWith(currentLang) || v.lang.includes(langCode));
    if (matchedVoice) utterance.voice = matchedVoice;

    speakingIndicator.classList.remove("hidden");
    speakingText.innerText = `Nagarik AI: "${text.length > 50 ? text.substring(0, 48) + '...' : text}"`;

    utterance.onend = () => speakingIndicator.classList.add("hidden");
    utterance.onerror = () => speakingIndicator.classList.add("hidden");

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

  // Saved citizen profile in memory
  let savedCitizenName = "";
  let savedCitizenPhone = "";

  // Restore saved profile from chrome.storage
  if (chrome.storage && chrome.storage.local) {
    chrome.storage.local.get(["saved_citizen_name", "saved_citizen_phone"], (res) => {
      if (res.saved_citizen_name) {
        savedCitizenName = res.saved_citizen_name;
        savedNameText.innerText = `Use: "${res.saved_citizen_name}"`;
        savedNameContainer.classList.remove("hidden");
        btnUseSavedName.onclick = () => {
          inputName.value = res.saved_citizen_name;
        };
      }
      if (res.saved_citizen_phone) {
        savedCitizenPhone = res.saved_citizen_phone;
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

  // Photo Input Handler
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
  function showStep(stepNum, shouldSpeak = true) {
    currentStep = stepNum;
    analyzingStage.classList.add("hidden");

    [step1, step2, step3, step4, step5, step6].forEach((el, idx) => {
      if (idx + 1 === stepNum) el.classList.add("active");
      else el.classList.remove("active");
    });

    const labels = DIALOGS[currentLang].step_labels;
    progressStepLabel.innerText = `Step ${stepNum}: ${labels[stepNum - 1] || 'Complete'}`;
    progressStepCount.innerText = `${stepNum} of 5`;
    progressBar.style.width = `${Math.min(stepNum * 20, 100)}%`;

    if (shouldSpeak) {
      const questionText = DIALOGS[currentLang][`q${stepNum}`];
      if (questionText) {
        setTimeout(() => speak(questionText), 200);
      }
    }
  }

  // ----------------------------------------------------------------
  // Autonomous Zero-Touch Portal Inspection & Studying
  // ----------------------------------------------------------------
  let activePortalName = "Civic Portal";
  let activePageHasForm = false;

  function autoStudyPortal() {
    if (tabStatusText) tabStatusText.innerText = "🔍 Nagarik AI is studying active page DOM...";
    if (tabStatusBadge) {
      tabStatusBadge.innerText = "STUDYING";
      tabStatusBadge.style.background = "var(--orange-primary)";
      tabStatusBadge.style.color = "var(--text-on-orange)";
      tabStatusBadge.style.borderColor = "var(--border-orange)";
    }

    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const activeTab = (tabs && tabs.length > 0) ? tabs[0] : null;
      const targetUrl = activeTab ? activeTab.url : window.location.href;
      const targetTitle = activeTab ? activeTab.title : document.title;

      // Ask backend to dynamically study the page
      fetch("http://localhost:8000/api/v1/agent/study-page", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url: targetUrl || "",
          title: targetTitle || ""
        })
      })
      .then(r => r.json())
      .then(study => {
        if (study && study.portal_name) {
          activePortalName = study.portal_name;
          activePageHasForm = !!study.has_form;

          if (study.portal_type === "STANDBY") {
            if (tabStatusText) {
              tabStatusText.innerHTML = `🌐 <strong>No Civic Portal Active</strong>`;
            }
            if (tabStatusBadge) {
              tabStatusBadge.innerText = "STANDBY";
              tabStatusBadge.style.background = "rgba(143, 147, 181, 0.2)";
              tabStatusBadge.style.color = "var(--text-slate)";
              tabStatusBadge.style.borderColor = "var(--border-slate)";
            }
          } else {
            if (tabStatusText) {
              tabStatusText.innerHTML = `🏛️ <strong>${study.portal_name}</strong>`;
            }
            if (tabStatusBadge) {
              tabStatusBadge.innerText = study.has_form ? "● FORM READY" : "⚠️ SIGN-IN TO LODGE";
              tabStatusBadge.style.background = study.has_form ? "#059669" : "#d97706";
              tabStatusBadge.style.color = study.has_form ? "#ffffff" : "#0B0C1E";
              tabStatusBadge.style.borderColor = study.has_form ? "#047857" : "#b45309";
            }
          }

          if (inputProblem && study.placeholder_text) {
            inputProblem.placeholder = study.placeholder_text;
          }

          if (q1Sub && study.welcome_greeting) {
            q1Sub.innerText = study.welcome_greeting;
          }

          if (q2Sub && study.location_question) {
            q2Sub.innerText = study.location_question;
          }

          // Dynamically populate Quick Chips for this portal!
          const chipsContainer = document.getElementById("chips-container");
          if (chipsContainer && study.chips && study.chips.length > 0) {
            chipsContainer.innerHTML = "";
            study.chips.forEach(chip => {
              const chipBtn = document.createElement("button");
              chipBtn.className = "chip";
              chipBtn.innerText = chip.label;
              chipBtn.setAttribute("data-text", chip.text);

              chipBtn.addEventListener("click", () => {
                if (chip.text && chip.text.startsWith("OPEN_PORTAL:")) {
                  const portalUrl = chip.text.replace("OPEN_PORTAL:", "");
                  if (activeTab && activeTab.id) {
                    chrome.tabs.update(activeTab.id, { url: portalUrl });
                  } else {
                    window.open(portalUrl, "_blank");
                  }
                  speak("Opening portal. Once the page loads, I will automatically inspect it and guide your grievance lodging.");
                } else {
                  inputProblem.value = chip.text;
                  inputProblem.focus();
                }
              });
              chipsContainer.appendChild(chipBtn);
            });
          }

          // Announce welcome aloud
          setTimeout(() => speak(study.welcome_greeting), 350);
        } else {
          // Safe fallback
          activePortalName = "Public Service Portal";
          if (tabStatusText) tabStatusText.innerHTML = `🏛️ <strong>Public Service Portal</strong>`;
          if (tabStatusBadge) tabStatusBadge.innerText = "STANDBY";
        }
      })
      .catch(err => {
        console.warn("Study page backend note:", err);
        // Fallback local inspection
        chrome.runtime.sendMessage({ action: "TRIGGER_INSPECT_PAGE" }, (res) => {
          if (res && res.supported) {
            activePortalName = res.portalName || "Public Service Portal";
            activePageHasForm = !!res.hasForm;
            if (tabStatusText) tabStatusText.innerHTML = `🏛️ <strong>${activePortalName}</strong>`;
            if (tabStatusBadge) tabStatusBadge.innerText = res.hasForm ? "● READY" : "STANDBY";
            setTimeout(() => speak(DIALOGS[currentLang].q1), 400);
          } else {
            if (tabStatusText) tabStatusText.innerHTML = `🌐 <strong>No Civic Portal Active</strong>`;
            if (tabStatusBadge) tabStatusBadge.innerText = "STANDBY";
          }
        });
      });
    });
  }

  // Trigger autonomous zero-touch inspection on load
  autoStudyPortal();

  // ----------------------------------------------------------------
  // STEP 1 -> ANIMATED REASONING -> STEP 2
  // ----------------------------------------------------------------
  btnNextStep1.addEventListener("click", () => {
    const text = inputProblem.value.trim();
    if (!text) {
      alert("Please tell or type what problem you are facing.");
      return;
    }

    complaintData.problem_raw = text;

    // 1. Hide Step 1 and activate the Animated Nagarik AI Reasoning Stage
    step1.classList.remove("active");
    analyzingStage.classList.remove("hidden");
    mandalaSpinner.classList.remove("complete");
    analyzingTitle.innerText = "Nagarik AI is Analyzing...";

    // Cycle through live reasoning steps
    let stepIndex = 0;
    const steps = REASONING_STEPS[currentLang] || REASONING_STEPS.en;
    reasoningTicker.innerHTML = `<span>${steps[0]}</span>`;
    
    if (reasoningInterval) clearInterval(reasoningInterval);
    reasoningInterval = setInterval(() => {
      stepIndex = (stepIndex + 1) % steps.length;
      reasoningTicker.style.opacity = "0";
      setTimeout(() => {
        reasoningTicker.innerHTML = `<span>${steps[stepIndex]}</span>`;
        reasoningTicker.style.opacity = "1";
      }, 200);
    }, 1600);

    // 2. Call Backend API
    chrome.runtime.sendMessage({
      action: "CALL_BACKEND_ANALYZE",
      payload: {
        raw_input: text,
        language: currentLang,
        location: inputLocation ? inputLocation.value : "",
        portal_context: activePortalName
      }
    }, (res) => {
      if (reasoningInterval) clearInterval(reasoningInterval);

      if (res && res.success && res.data) {
        const d = res.data;

        // -------------------------------------------------------------
        // 1. INTENT: PORTAL GUIDANCE (e.g. "help me sign in", "where is login")
        // -------------------------------------------------------------
        if (d.intent === "PORTAL_GUIDANCE") {
          analyzingStage.classList.add("hidden");
          step1.classList.add("active");

          const guidanceCard = document.getElementById("guidance-card");
          const guidanceTitle = document.getElementById("guidance-title");
          const guidanceMessage = document.getElementById("guidance-message");
          const btnGuidanceHighlight = document.getElementById("btn-guidance-highlight");
          const btnGuidanceClick = document.getElementById("btn-guidance-click");

          if (guidanceCard && guidanceTitle && guidanceMessage) {
            guidanceTitle.innerText = d.guidance_title || "Portal Guidance";
            guidanceMessage.innerText = d.guidance_message || "Here is what to do on this page...";
            guidanceCard.classList.remove("hidden");

            if (btnGuidanceHighlight) {
              btnGuidanceHighlight.onclick = () => {
                chrome.runtime.sendMessage({
                  action: "TRIGGER_HIGHLIGHT_ELEMENT",
                  target: d.action_type === "HIGHLIGHT_REGISTER" ? "REGISTER" : "SIGN_IN"
                });
                speak("Highlighting on your webpage now.");
              };
            }

            if (btnGuidanceClick) {
              btnGuidanceClick.onclick = () => {
                chrome.runtime.sendMessage({
                  action: "TRIGGER_CLICK_ELEMENT",
                  target: d.action_type === "HIGHLIGHT_REGISTER" ? "REGISTER" : "SIGN_IN"
                });
                speak("Opening sign-in for you.");
              };
            }
          }

          // Automatically trigger highlight on the page
          chrome.runtime.sendMessage({
            action: "TRIGGER_HIGHLIGHT_ELEMENT",
            target: d.action_type === "HIGHLIGHT_REGISTER" ? "REGISTER" : "SIGN_IN"
          });

          speak(d.guidance_message || "Please check the highlighted button on your screen to sign in.");
          return; // STOP! Never ask location/phone when user asked for guidance!
        }

        // -------------------------------------------------------------
        // 2. INTENT: GRIEVANCE REPORTING
        // -------------------------------------------------------------
        complaintData.department = d.department;
        complaintData.category = d.category;
        complaintData.urgency_level = d.urgency_level;
        complaintData.urgency_score = d.urgency_score;
        complaintData.description = d.description;

        if (d.privacy_warning) {
          privacyBanner.classList.remove("hidden");
        }

        if (d.location_text && !d.location_text.toLowerCase().includes("pending")) {
          complaintData.location = d.location_text;
          if (inputLocation) inputLocation.value = d.location_text;
        }

        // Check if citizen profile is saved
        if (savedCitizenName) complaintData.citizen_name = savedCitizenName;
        if (savedCitizenPhone) complaintData.citizen_phone = savedCitizenPhone;

        // ADAPTIVE PATHWAY: Does the active page have a form right now?
        if (activePageHasForm) {
          // PATH A: FULL AUTOMATE (Form is active on screen)
          chrome.runtime.sendMessage({
            action: "TRIGGER_FILL_FIELDS",
            fields: complaintData
          });

          mandalaSpinner.classList.add("complete");
          analyzingTitle.innerText = "⚡ Form Auto-Filled!";
          speak(`Classified under ${d.department}. I have automatically populated the active form on your screen.`);

          setTimeout(() => {
            finalizeToStep6();
          }, 1200);
        } else {
          // PATH B: GUIDED HANDOFF (Landing or Sign-In page, e.g. CPGRAMS Home)
          mandalaSpinner.classList.add("complete");
          analyzingTitle.innerText = "📋 Petition Saved in Memory!";
          speak(`Grievance drafted under ${d.department}! Please sign in on CPGRAMS as highlighted on your screen. As soon as you log in, I will auto-fill your petition.`);

          // Automatically highlight the Sign In button on CPGRAMS
          chrome.runtime.sendMessage({
            action: "TRIGGER_HIGHLIGHT_ELEMENT",
            target: "SIGN_IN"
          });

          setTimeout(() => {
            finalizeToStep6();
          }, 1200);
        }
      } else {
        analyzingStage.classList.add("hidden");
        step1.classList.add("active");
        alert("Could not reach Nagarik AI backend. Ensure port 8000 is active.");
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

    chrome.runtime.sendMessage({
      action: "TRIGGER_SINGLE_FIELD_FILL",
      key: "location",
      value: loc,
      label: "Location"
    });

    speak(DIALOGS[currentLang].location_saved);
    setTimeout(() => showStep(3), 500);
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

    if (chrome.storage && chrome.storage.local) {
      chrome.storage.local.set({ saved_citizen_name: name });
    }

    chrome.runtime.sendMessage({
      action: "TRIGGER_SINGLE_FIELD_FILL",
      key: "citizen_name",
      value: name,
      label: "Citizen Name"
    });

    speak(DIALOGS[currentLang].name_saved(name));
    setTimeout(() => showStep(4), 500);
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

    if (chrome.storage && chrome.storage.local) {
      chrome.storage.local.set({ saved_citizen_phone: complaintData.citizen_phone });
    }

    chrome.runtime.sendMessage({
      action: "TRIGGER_SINGLE_FIELD_FILL",
      key: "citizen_phone",
      value: complaintData.citizen_phone,
      label: "Contact Phone"
    });

    speak(DIALOGS[currentLang].phone_saved);
    setTimeout(() => showStep(5), 500);
  });

  // STEP 5 -> STEP 6: Photo & Final Review
  btnBackStep5.addEventListener("click", () => showStep(4));
  
  function finalizeToStep6() {
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

    // Verify whether active portal actually has an open form
    chrome.runtime.sendMessage({ action: "TRIGGER_INSPECT_PAGE" }, (res) => {
      activePageHasForm = res && res.supported && res.hasForm;

      if (activePageHasForm) {
        // Grievance form is active on page! Perform full batch injection
        chrome.runtime.sendMessage({
          action: "TRIGGER_FILL_FIELDS",
          fields: complaintData
        });

        if (step6Icon) step6Icon.innerText = "🎉";
        if (step6Title) {
          step6Title.innerText = "All Fields Populated on Portal!";
          step6Title.style.color = "#34d399";
        }
        if (step6Subtitle) {
          step6Subtitle.innerText = "Nagarik AI has populated every required field directly into the active portal on your screen.";
        }
        if (step6ActionBox) step6ActionBox.style.borderColor = "var(--orange-primary)";
        if (step6ActionIcon) step6ActionIcon.innerText = "👉";
        if (step6ActionTitle) {
          step6ActionTitle.innerText = "LOOK AT THE PORTAL ON YOUR SCREEN";
          step6ActionTitle.style.color = "var(--orange-hover)";
        }
        if (step6ActionText) {
          step6ActionText.innerHTML = `All form fields have been highlighted and populated. Please verify, complete CAPTCHA if needed, and click the <strong>"Submit Grievance"</strong> button on the webpage to finish!`;
        }
        if (btnInjectNow) btnInjectNow.classList.add("hidden");

        showStep(6, false);
        speak(`All done! Every detail has been populated on the active portal. Please look at your screen, verify, and click Submit on the webpage to finish.`);
      } else {
        // Landing page or Sign-in page (e.g. pgportal.gov.in homepage)
        if (step6Icon) step6Icon.innerText = "📋";
        if (step6Title) {
          step6Title.innerText = "Petition Drafted & Ready in Copilot Memory!";
          step6Title.style.color = "#f59e0b";
        }
        if (step6Subtitle) {
          step6Subtitle.innerText = "You are currently on the CPGRAMS home page. Government rules require signing in before lodging a grievance.";
        }
        if (step6ActionBox) step6ActionBox.style.borderColor = "#f59e0b";
        if (step6ActionIcon) step6ActionIcon.innerText = "🔐";
        if (step6ActionTitle) {
          step6ActionTitle.innerText = "SIGN IN TO CPGRAMS TO FILE";
          step6ActionTitle.style.color = "#f59e0b";
        }
        if (step6ActionText) {
          step6ActionText.innerHTML = `Please click the yellow <strong>"Sign In"</strong> button on the CPGRAMS page (top-right). As soon as the grievance form opens, tap the button below to inject everything in 1 second!`;
        }
        if (btnInjectNow) btnInjectNow.classList.remove("hidden");

        showStep(6, false);
        speak(`Your petition has been drafted and saved in memory. You are currently on the CPGRAMS home page. Please click Sign In to reach the grievance filing page, then tap Inject to populate all fields.`);
      }
    });
  }

  // Handler for "Inject Saved Draft into Form" button
  if (btnInjectNow) {
    btnInjectNow.addEventListener("click", () => {
      chrome.runtime.sendMessage({ action: "TRIGGER_INSPECT_PAGE" }, (res) => {
        if (res && res.supported && res.hasForm) {
          chrome.runtime.sendMessage({
            action: "TRIGGER_FILL_FIELDS",
            fields: complaintData
          }, (fillRes) => {
            if (step6Icon) step6Icon.innerText = "🎉";
            if (step6Title) {
              step6Title.innerText = "All Fields Populated on Portal!";
              step6Title.style.color = "#34d399";
            }
            if (step6Subtitle) {
              step6Subtitle.innerText = "Nagarik AI has populated every required field directly into the active portal on your screen.";
            }
            if (step6ActionTitle) {
              step6ActionTitle.innerText = "LOOK AT THE PORTAL ON YOUR SCREEN";
              step6ActionTitle.style.color = "var(--orange-hover)";
            }
            if (step6ActionText) {
              step6ActionText.innerHTML = `All form fields have been highlighted and populated. Please verify, enter CAPTCHA if needed, and click the <strong>"Submit Grievance"</strong> button on the webpage to finish!`;
            }
            btnInjectNow.classList.add("hidden");
            speak(`Draft injected into portal! Please verify, solve CAPTCHA, and click Submit.`);
          });
        } else {
          alert("Grievance form is not yet open on the active tab.\n\nPlease click 'Sign In' (or 'Lodge a Grievance') on CPGRAMS first to reach the grievance form, then tap this button.");
        }
      });
    });
  }

  btnSkipPhoto.addEventListener("click", finalizeToStep6);
  btnNextStep5.addEventListener("click", finalizeToStep6);

  // Restart Wizard
  function restartWizard() {
    inputProblem.value = "";
    inputLocation.value = "";
    complaintData.photo_base64 = null;
    inputPhoto.value = "";
    photoPreviewBox.classList.add("hidden");
    receiptCard.classList.add("hidden");
    showStep(1);
  }

  btnRestartWizard.addEventListener("click", restartWizard);
  if (btnNewAfterReceipt) btnNewAfterReceipt.addEventListener("click", restartWizard);

  // ----------------------------------------------------------------
  // Real-Time Tab Changes & Official Receipt Detection
  // ----------------------------------------------------------------
  chrome.runtime.onMessage.addListener((message) => {
    if (message.action === "ACTIVE_TAB_CHANGED") {
      autoStudyPortal();
    }
    if (message.action === "UPDATE_TRACKING_RECEIPT") {
      receiptTrackingId.innerText = message.trackingId;
      step6.classList.remove("active");
      receiptCard.classList.remove("hidden");
      receiptCard.scrollIntoView({ behavior: "smooth" });
      speak(`Grievance registered! Official tracking reference is ${message.trackingId}`);
    }
  });
});
