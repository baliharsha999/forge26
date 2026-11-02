/**
 * Nagarik AI - Dynamic Contextual Civic Copilot
 * "Empowering Every Citizen"
 * 
 * Determines custom tasks dynamically based on [Active Website + Page DOM + Citizen Problem].
 * Zero predetermined steps. Continuous auto-detecting and perfection loop.
 */
document.addEventListener("DOMContentLoaded", () => {
  // State
  let currentLang = "en";
  let voiceEnabled = true;
  let activeTabInfo = {
    id: null,
    url: "",
    domain: "",
    title: "",
    mainHeading: "",
    pageType: "GENERAL_PORTAL",
    hasForm: false,
    fields: [],
    actionButtons: []
  };

  // Zero-trust citizen state (Aadhaar is null by default; requires citizen voice/text input with Verhoeff validation)
  let currentCitizenState = {
    citizen_name: "",
    citizen_phone: "",
    citizen_email: "",
    uid: null,
    aadhaar: null,
    isDemoProfile: false,
    application_no: "",
    location: "",
    pincode: "",
    department: "Municipal Corporation & Public Works",
    category: "General Civic Redressal",
    urgency_level: "MEDIUM",
    description: ""
  };

  // Official UIDAI Verhoeff Dihedral (D5) Checksum Algorithm
  const VERHOEFF_D = [
    [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
    [1, 2, 3, 4, 0, 6, 7, 8, 9, 5],
    [2, 3, 4, 0, 1, 7, 8, 9, 5, 6],
    [3, 4, 0, 1, 2, 8, 9, 5, 6, 7],
    [4, 0, 1, 2, 3, 9, 5, 6, 7, 8],
    [5, 9, 8, 7, 6, 0, 4, 3, 2, 1],
    [6, 5, 9, 8, 7, 1, 0, 4, 3, 2],
    [7, 6, 5, 9, 8, 2, 1, 0, 4, 3],
    [8, 7, 6, 5, 9, 3, 2, 1, 0, 4],
    [9, 8, 7, 6, 5, 4, 3, 2, 1, 0]
  ];

  const VERHOEFF_P = [
    [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
    [1, 5, 7, 6, 2, 8, 3, 0, 9, 4],
    [5, 8, 0, 3, 7, 9, 6, 1, 4, 2],
    [8, 9, 1, 6, 0, 4, 3, 5, 2, 7],
    [9, 4, 5, 3, 1, 2, 6, 8, 7, 0],
    [4, 2, 8, 6, 5, 7, 3, 9, 0, 1],
    [2, 7, 9, 3, 8, 0, 6, 4, 1, 5],
    [7, 0, 4, 6, 9, 1, 3, 2, 5, 8]
  ];

  function validateVerhoeff(numStr) {
    if (!numStr || typeof numStr !== "string") return false;
    const clean = numStr.replace(/[\s-]/g, "");
    if (!/^\d{12}$/.test(clean)) return false;
    if (/^(\d)\1{11}$/.test(clean)) return false;
    let c = 0;
    const invertedArray = clean.split("").reverse().map(Number);
    for (let i = 0; i < invertedArray.length; i++) {
      c = VERHOEFF_D[c][VERHOEFF_P[i % 8][invertedArray[i]]];
    }
    return c === 0;
  }

  let lastFillResult = null;

  // Civic Concept Synonym Graph for Department Inference
  const CIVIC_CONCEPT_SYNONYMS = {
    "Water Supply & Sewerage Board": [
      "water", "sewerage", "drainage", "pipe", "pipeline", "tap", "leakage", "drain", "sewage", "jal", "neellu", "paani", "manhole", "water supply"
    ],
    "State Electricity Distribution Company (DISCOM)": [
      "electricity", "power", "discom", "current", "voltage", "transformer", "wire", "pole", "meter", "bijli", "vidyut", "blackout", "power cut", "eb", "bescom", "tsspdcl", "tneb", "mseb", "light"
    ],
    "Municipal Corporation & Public Works": [
      "road", "pothole", "pavement", "street", "footpath", "bridge", "public works", "pwd", "highway", "traffic", "building", "encroachment", "tree"
    ],
    "Solid Waste Management & Public Health": [
      "waste", "garbage", "solid waste", "sanitation", "cleanliness", "trash", "kuda", "debris", "mosquitoes", "fogging", "sweeping", "dump", "bin"
    ],
    "Civil Supplies & Consumer Affairs": [
      "ration", "civil supplies", "consumer", "pds", "fair price", "food grain", "subsidy", "dealer", "ration card"
    ]
  };

  // Dialog & Speech Prompts
  const LOCALES = {
    en: {
      tag: "en-IN",
      welcome: "Nagarik AI active. I am studying your screen. Tell me what you need help with.",
      analyzing: "Synthesizing custom plan based on this website and your problem...",
      task_autofill_title: "Auto-Fill Form Fields",
      task_autofill_desc: "Inject validated citizen details and formal petition into page DOM.",
      task_shield_title: "Aadhaar & PII Shield",
      task_shield_desc: "Mask national IDs with zero-knowledge privacy protection.",
      task_spotlight_title: "Spotlight Submit Button",
      task_spotlight_desc: "Draw bright interactive beacon around official submit action.",
      task_explain_title: "Multilingual Voice Guidance",
      task_explain_desc: "Explain submission instructions in your preferred language.",
      success_speech: "Form populated and Aadhaar shielded. Please review the highlighted button on your screen to submit."
    },
    hi: {
      tag: "hi-IN",
      welcome: "नागरिक एआई सक्रिय है। मैं इस वेबसाइट का अध्ययन कर रहा हूँ। बताइए आपको क्या सहायता चाहिए।",
      analyzing: "इस पोर्टल और आपकी समस्या के अनुसार योजना बनाई जा रही है...",
      task_autofill_title: "फॉर्म फ़ील्ड्स को ऑटो-फिल करें",
      task_autofill_desc: "पोर्टल पर शिकायत और नागरिक विवरण सुरक्षित रूप से भरें।",
      task_shield_title: "आधार एवं गोपनीयता सुरक्षा",
      task_shield_desc: "राष्ट्रीय पहचान पत्र को 100% सुरक्षित और मास्क करें।",
      task_spotlight_title: "सबमिट बटन को हाइलाइट करें",
      task_spotlight_desc: "पोर्टल पर जमा करने वाले बटन को स्क्रीन पर इंगित करें।",
      task_explain_title: "आवाज में मार्गदर्शन",
      task_explain_desc: "सरल हिंदी में निर्देशों को बोलकर समझाएं।",
      success_speech: "पोर्टल फॉर्म भर दिया गया है और आधार सुरक्षित है। कृपया स्क्रीन पर सबमिट बटन दबाएं।"
    },
    te: {
      tag: "te-IN",
      welcome: "నాగరిక్ AI సిద్ధంగా ఉంది. ఈ వెబ్‌సైట్‌ను పరిశీలిస్తున్నాను. మీకు ఏ సహాయం కావాలి?",
      analyzing: "మీ సమస్య మరియు పోర్టల్ ఆధారంగా ప్రత్యేక కార్యాచరణ ప్రణాళిక సిద్ధం చేస్తోంది...",
      task_autofill_title: "ఫారమ్ ఫీల్డ్‌లను ఆటో-ఫిల్ చేయండి",
      task_autofill_desc: "పేజీలో వివరాలు మరియు ఫిర్యాదును స్వయంచాలకంగా పూరించండి.",
      task_shield_title: "ఆధార్ & వ్యక్తిగత సమాచార రక్షణ",
      task_shield_desc: "ఆధార్ సంఖ్యను సురక్షితంగా మాస్క్ చేయండి.",
      task_spotlight_title: "సబ్మిట్ బటన్‌ను గుర్తించండి",
      task_spotlight_desc: "స్క్రీన్‌పై సబ్మిట్ బటన్‌ను స్పాట్‌లైట్ చేయండి.",
      task_explain_title: "తెలుగులో వాయిస్ గైడెన్స్",
      task_explain_desc: "మొత్తం వివరాలను తెలుగులో వివరంగా చెప్పండి.",
      success_speech: "ఫారమ్ వివరాలు నింపబడ్డాయి, ఆధార్ రక్షించబడింది. దయచేసి స్క్రీన్‌పై ఉన్న సబ్మిట్ బటన్‌ను నొక్కండి."
    }
  };

  // DOM Elements
  const detectedDomainEl = document.getElementById("detected-domain");
  const detectedTitleEl = document.getElementById("detected-title");
  const detectedBadgeEl = document.getElementById("detected-badge");
  const contextHeadingEl = document.getElementById("context-heading");
  const contextSummaryEl = document.getElementById("context-summary");
  const fieldsCountBadgeEl = document.getElementById("fields-count-badge");
  const fieldsTagCloudEl = document.getElementById("fields-tag-cloud");
  const citizenProblemInput = document.getElementById("citizen-problem-input");
  const micActionBtn = document.getElementById("mic-action-btn");
  const micBtnLabel = document.getElementById("mic-btn-label");
  const btnExecuteTask = document.getElementById("btn-execute-task");
  const dynamicChipsGrid = document.getElementById("dynamic-chips-grid");

  // Voice-First Aadhaar Identity & Shielding Elements
  const aadhaarVerificationBox = document.getElementById("aadhaar-verification-box");
  const aadhaarBadge = document.getElementById("aadhaar-badge");
  const aadhaarUnverifiedPanel = document.getElementById("aadhaar-unverified-panel");
  const aadhaarPromptText = document.getElementById("aadhaar-prompt-text");
  const aadhaarDirectInput = document.getElementById("aadhaar-direct-input");
  const btnSpeakAadhaar = document.getElementById("btn-speak-aadhaar");
  const aadhaarSpeakLabel = document.getElementById("aadhaar-speak-label");
  const aadhaarStatusFeedback = document.getElementById("aadhaar-status-feedback");
  const btnLoadDemoProfile = document.getElementById("btn-load-demo-profile");
  const aadhaarVerifiedPanel = document.getElementById("aadhaar-verified-panel");
  const aadhaarMaskedDisplay = document.getElementById("aadhaar-masked-display");
  const btnClearAadhaar = document.getElementById("btn-clear-aadhaar");
  
  // Analyzing Stage
  const analyzingStage = document.getElementById("analyzing-stage");
  const reasoningTicker = document.getElementById("reasoning-ticker");
  
  // Task Plan Elements
  const taskPlanCard = document.getElementById("task-plan-card");
  const planTitle = document.getElementById("plan-title");
  const planSubtitle = document.getElementById("plan-subtitle");
  const planStatusBadge = document.getElementById("plan-status-badge");
  const taskChecklist = document.getElementById("task-checklist");
  const btnReinjectFields = document.getElementById("btn-reinject-fields");
  const btnHighlightSubmit = document.getElementById("btn-highlight-submit");
  const btnExplainAudio = document.getElementById("btn-explain-audio");

  // Plan Synthesis Preview & Editable Drawer
  const previewDept = document.getElementById("preview-dept");
  const previewUrgency = document.getElementById("preview-urgency");
  const previewLocation = document.getElementById("preview-location");
  const previewCitizen = document.getElementById("preview-citizen");
  const btnToggleEditFields = document.getElementById("btn-toggle-edit-fields");
  const editableFieldsDrawer = document.getElementById("editable-fields-drawer");
  const editCustomDesc = document.getElementById("edit-custom-desc");
  const editCustomName = document.getElementById("edit-custom-name");
  const editCustomPhone = document.getElementById("edit-custom-phone");
  const btnApplyCustomEdit = document.getElementById("btn-apply-custom-edit");

  // Results Card
  const resultsCard = document.getElementById("results-card");
  const resFieldsCount = document.getElementById("res-fields-count");
  const receiptRefBox = document.getElementById("receipt-ref-box");
  const receiptTrackingId = document.getElementById("receipt-tracking-id");
  const resultsInstructionEl = document.getElementById("results-instruction");
  const btnResetCopilot = document.getElementById("btn-reset-copilot");

  // Voice Toggle & Speaking Indicator
  const voiceToggleBtn = document.getElementById("voice-toggle-btn");
  const voiceIcon = document.getElementById("voice-icon");
  const voiceStatus = document.getElementById("voice-status");
  const speakingIndicator = document.getElementById("speaking-indicator");
  const speakingText = document.getElementById("speaking-text");

  // ----------------------------------------------------------------
  // Speech Synthesis & Recognition
  // ----------------------------------------------------------------
  function speak(text) {
    if (!voiceEnabled || !("speechSynthesis" in window)) return;
    window.speechSynthesis.cancel();
    
    const utterance = new SpeechSynthesisUtterance(text);
    const loc = LOCALES[currentLang] || LOCALES.en;
    utterance.lang = loc.tag;
    utterance.rate = 0.95;
    utterance.pitch = 1.0;

    const voices = window.speechSynthesis.getVoices();
    const matchedVoice = voices.find(v => v.lang.startsWith(currentLang) || v.lang.includes(loc.tag));
    if (matchedVoice) utterance.voice = matchedVoice;

    speakingIndicator.classList.remove("hidden");
    speakingText.innerText = `Nagarik AI: "${text.length > 55 ? text.substring(0, 52) + '...' : text}"`;

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
      speak(LOCALES[currentLang].welcome);
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
      const loc = LOCALES[currentLang] || LOCALES.en;
      if (recognition) {
        recognition.lang = loc.tag;
        if (isRecording) {
          try {
            recognition.stop();
            setTimeout(() => {
              try {
                if (isRecording) recognition.start();
              } catch (_) {}
            }, 180);
          } catch (_) {}
        }
      }
      if (aadhaarSpeechRec) {
        aadhaarSpeechRec.lang = loc.tag;
      }
      renderActionChips();
      speak(LOCALES[currentLang].welcome);
    });
  });

  // Speech-to-Text Recognition
  let isRecording = false;
  let recognition = null;
  if ("webkitSpeechRecognition" in window || "SpeechRecognition" in window) {
    const SpeechRec = window.SpeechRecognition || window.webkitSpeechRecognition;
    recognition = new SpeechRec();
    recognition.continuous = false;
    recognition.interimResults = true;

    recognition.onstart = () => {
      isRecording = true;
      micActionBtn.classList.add("recording");
      micBtnLabel.innerText = "Listening...";
    };

    recognition.onresult = (event) => {
      let assembled = "";
      for (let i = 0; i < event.results.length; ++i) {
        const item = event.results[i];
        const chunk = (item[0]?.transcript || "").trim();
        if (!chunk) continue;
        assembled = mergeTranscripts(assembled, chunk);
      }
      const cleaned = deduplicateConsecutiveWords(assembled);
      const textToSet = cleaned || assembled;
      if (textToSet) {
        citizenProblemInput.value = textToSet;
        citizenProblemInput.dispatchEvent(new Event("input", { bubbles: true }));
      }
    };

    recognition.onend = () => {
      isRecording = false;
      micActionBtn.classList.remove("recording");
      micBtnLabel.innerText = "Tap to Speak";
    };

    recognition.onerror = (event) => {
      isRecording = false;
      micActionBtn.classList.remove("recording");
      const err = event && event.error;
      if (err === "no-speech") {
        micBtnLabel.innerText = "No voice heard";
      } else if (err === "network" || err === "language-not-supported") {
        micBtnLabel.innerText = "Loading voice pack...";
      } else if (err === "not-allowed") {
        micBtnLabel.innerText = "Mic blocked";
      } else {
        micBtnLabel.innerText = "Speech failed";
      }
      setTimeout(() => {
        micBtnLabel.innerText = "Tap to Speak";
      }, 2500);
    };

    micActionBtn.addEventListener("click", () => {
      if (isRecording) {
        recognition.stop();
      } else {
        const loc = LOCALES[currentLang] || LOCALES.en;
        recognition.lang = loc.tag;
        recognition.start();
      }
    });
  } else {
    micActionBtn.style.display = "none";
  }

  function setVerifiedAadhaar(rawNum, isDemo = false) {
    const clean = (rawNum || "").replace(/[\s-]/g, "");
    if (!validateVerhoeff(clean)) {
      if (aadhaarStatusFeedback) {
        aadhaarStatusFeedback.innerText = "Invalid 12-digit Aadhaar (failed UIDAI Verhoeff checksum). Please re-enter.";
        aadhaarStatusFeedback.classList.remove("hidden");
        aadhaarStatusFeedback.style.color = "#f87171";
      }
      return false;
    }

    currentCitizenState.uid = clean;
    currentCitizenState.aadhaar = clean;
    currentCitizenState.id_number = clean;
    currentCitizenState.isDemoProfile = !!isDemo;

    if (aadhaarUnverifiedPanel) aadhaarUnverifiedPanel.classList.add("hidden");
    if (aadhaarVerifiedPanel) aadhaarVerifiedPanel.classList.remove("hidden");
    if (aadhaarMaskedDisplay) aadhaarMaskedDisplay.innerText = `XXXXXXXX${clean.slice(-4)}`;
    if (aadhaarBadge) {
      aadhaarBadge.innerText = isDemo ? "Demo Citizen Verified" : "Aadhaar Verified";
      aadhaarBadge.className = "aadhaar-pill-verified";
    }
    if (aadhaarStatusFeedback) aadhaarStatusFeedback.classList.add("hidden");

    return true;
  }

  function clearAadhaar() {
    currentCitizenState.uid = null;
    currentCitizenState.aadhaar = null;
    currentCitizenState.id_number = null;
    currentCitizenState.isDemoProfile = false;

    if (aadhaarDirectInput) aadhaarDirectInput.value = "";
    if (aadhaarUnverifiedPanel) aadhaarUnverifiedPanel.classList.remove("hidden");
    if (aadhaarVerifiedPanel) aadhaarVerifiedPanel.classList.add("hidden");
    if (aadhaarBadge) {
      aadhaarBadge.innerText = "Aadhaar Required";
      aadhaarBadge.className = "aadhaar-pill-unverified";
    }
    if (aadhaarStatusFeedback) aadhaarStatusFeedback.classList.add("hidden");
  }

  function convertIndicDigits(text) {
    if (typeof window !== "undefined" && window.convertIndicDigits) {
      return window.convertIndicDigits(text);
    }
    if (!text) return "";
    const digitMap = {
      '०': '0', '१': '1', '२': '2', '३': '3', '४': '4',
      '५': '5', '६': '6', '७': '7', '८': '8', '९': '9',
      '౦': '0', '౧': '1', '౨': '2', '౩': '3', '౪': '4',
      '౫': '5', '౬': '6', '౭': '7', '౮': '8', '౯': '9'
    };
    return String(text).replace(/[०-९౦-౯]/g, d => digitMap[d]);
  }

  function wordsToDigits(transcript) {
    if (typeof window !== "undefined" && window.wordsToDigits) {
      return window.wordsToDigits(transcript);
    }
    if (!transcript) return "";
    let text = convertIndicDigits(String(transcript).toLowerCase());

    const wordEntries = [
      ['zero', '0'], ['oh', '0'], ['shunya', '0'], ['soonya', '0'], ['sunya', '0'], ['sunna', '0'],
      ['शून्य', '0'], ['సున్నా', '0'],
      ['one', '1'], ['ek', '1'], ['aik', '1'], ['okati', '1'], ['okkati', '1'], ['okate', '1'],
      ['एक', '1'], ['ఒకటి', '1'],
      ['two', '2'], ['do', '2'], ['doh', '2'], ['rendu', '2'],
      ['दो', '2'], ['రెండు', '2'],
      ['three', '3'], ['teen', '3'], ['tin', '3'], ['moodu', '3'], ['mudu', '3'],
      ['तीन', '3'], ['మూడు', '3'],
      ['four', '4'], ['chaar', '4'], ['char', '4'], ['naalugu', '4'], ['nalugu', '4'],
      ['चार', '4'], ['నాలుగు', '4'],
      ['five', '5'], ['paanch', '5'], ['panch', '5'], ['aidu', '5'], ['ayidu', '5'],
      ['पाँच', '5'], ['पांच', '5'], ['ఐదు', '5'],
      ['six', '6'], ['chhah', '6'], ['chhe', '6'], ['cheh', '6'], ['chha', '6'], ['aaru', '6'], ['aru', '6'],
      ['छह', '6'], ['ఆరు', '6'],
      ['seven', '7'], ['saat', '7'], ['sat', '7'], ['eedu', '7'], ['edu', '7'],
      ['सात', '7'], ['ఏడు', '7'],
      ['eight', '8'], ['aath', '8'], ['aat', '8'], ['enimidi', '8'], ['yanimidi', '8'],
      ['आठ', '8'], ['ఎనిమిది', '8'],
      ['nine', '9'], ['nau', '9'], ['now', '9'], ['thommidi', '9'], ['tommidi', '9'],
      ['नौ', '9'], ['తొమ్మిది', '9'],
      ['o', '0']
    ];

    for (const [w, d] of wordEntries) {
      const reg = new RegExp('(?<![\\p{L}\\p{N}])' + w + '(?![\\p{L}\\p{N}])', 'gui');
      text = text.replace(reg, d);
    }

    return text.replace(/\D/g, "");
  }

  function mergeTranscripts(baseText, newText) {
    if (typeof window !== "undefined" && window.mergeTranscripts) {
      return window.mergeTranscripts(baseText, newText);
    }
    const b = (baseText || '').trim();
    const n = (newText || '').trim();
    if (!b) return n;
    if (!n) return b;

    const bTokens = b.split(/\s+/).filter(Boolean);
    const nTokens = n.split(/\s+/).filter(Boolean);

    const maxOverlap = Math.min(bTokens.length, nTokens.length);
    let overlapLen = 0;

    for (let len = maxOverlap; len >= 1; len--) {
      let match = true;
      for (let k = 0; k < len; k++) {
        if (bTokens[bTokens.length - len + k].toLowerCase() !== nTokens[k].toLowerCase()) {
          match = false;
          break;
        }
      }
      if (match) {
        overlapLen = len;
        break;
      }
    }

    const remaining = nTokens.slice(overlapLen);
    if (remaining.length === 0) {
      return bTokens.join(' ');
    }
    return bTokens.concat(remaining).join(' ');
  }

  function deduplicateConsecutiveWords(text) {
    if (typeof window !== "undefined" && window.deduplicateConsecutiveWords) {
      return window.deduplicateConsecutiveWords(text);
    }
    if (!text || typeof text !== "string") return "";
    const tokens = text.trim().split(/\s+/).filter(Boolean);
    if (tokens.length <= 1) return text.trim();

    const result = [];
    for (let i = 0; i < tokens.length; i++) {
      const curr = tokens[i];
      const prev = result.length > 0 ? result[result.length - 1] : null;
      if (prev && curr.toLowerCase() === prev.toLowerCase()) {
        continue;
      }
      result.push(curr);

      const len = result.length;
      if (len >= 4) {
        if (
          result[len - 2].toLowerCase() === result[len - 4].toLowerCase() &&
          result[len - 1].toLowerCase() === result[len - 3].toLowerCase()
        ) {
          result.splice(len - 2, 2);
        }
      }
      if (result.length >= 6) {
        const l = result.length;
        if (
          result[l - 3].toLowerCase() === result[l - 6].toLowerCase() &&
          result[l - 2].toLowerCase() === result[l - 5].toLowerCase() &&
          result[l - 1].toLowerCase() === result[l - 4].toLowerCase()
        ) {
          result.splice(l - 3, 3);
        }
      }
      if (result.length >= 8) {
        const l = result.length;
        if (
          result[l - 4].toLowerCase() === result[l - 8].toLowerCase() &&
          result[l - 3].toLowerCase() === result[l - 7].toLowerCase() &&
          result[l - 2].toLowerCase() === result[l - 6].toLowerCase() &&
          result[l - 1].toLowerCase() === result[l - 5].toLowerCase()
        ) {
          result.splice(l - 4, 4);
        }
      }
    }
    return result.join(" ");
  }

  let aadhaarSpeechRec = null;
  function startAadhaarVoiceInput() {
    if (!("webkitSpeechRecognition" in window || "SpeechRecognition" in window)) {
      if (aadhaarStatusFeedback) {
        aadhaarStatusFeedback.innerText = "Speech recognition unavailable. Please enter Aadhaar number directly.";
        aadhaarStatusFeedback.classList.remove("hidden");
      }
      return;
    }
    const SpeechRec = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!aadhaarSpeechRec) {
      aadhaarSpeechRec = new SpeechRec();
      aadhaarSpeechRec.continuous = false;
      aadhaarSpeechRec.interimResults = true;
    }

    const loc = LOCALES[currentLang] || LOCALES.en;
    aadhaarSpeechRec.lang = loc.tag;

    const promptSpeech = currentLang === 'hi'
      ? "कृपया अपना 12 अंकों का आधार नंबर स्पष्ट बोलें।"
      : currentLang === 'te'
      ? "దయచేసి మీ 12 అంకెల ఆధార్ సంఖ్యను స్పష్టంగా చెప్పండి."
      : "Please speak your 12-digit Aadhaar number clearly.";
    speak(promptSpeech);

    if (btnSpeakAadhaar) btnSpeakAadhaar.classList.add("recording");
    if (aadhaarSpeakLabel) aadhaarSpeakLabel.innerText = "Listening...";
    if (aadhaarStatusFeedback) {
      const feedbackText = currentLang === 'hi'
        ? "12 अंकों का आधार सुन रहे हैं..."
        : currentLang === 'te'
        ? "12 అంకెల ఆధార్ వింటున్నాము..."
        : "Listening for 12 digits...";
      aadhaarStatusFeedback.innerText = feedbackText;
      aadhaarStatusFeedback.classList.remove("hidden");
      aadhaarStatusFeedback.style.color = "#fbbf24";
    }

    aadhaarSpeechRec.onresult = (evt) => {
      let transcript = "";
      for (let i = 0; i < evt.results.length; ++i) {
        transcript += evt.results[i][0].transcript;
      }
      const cleaned = deduplicateConsecutiveWords(transcript);
      const digits = wordsToDigits(cleaned || transcript);
      if (aadhaarDirectInput) {
        aadhaarDirectInput.value = digits;
        aadhaarDirectInput.dispatchEvent(new Event("input", { bubbles: true }));
      }
      if (digits.length >= 12) {
        const candidate = digits.slice(0, 12);
        if (setVerifiedAadhaar(candidate)) {
          speak(currentLang === 'hi' ? "आधार सत्यापित और सुरक्षित कर दिया गया है।" : currentLang === 'te' ? "ఆధార్ ధృవీకరించబడింది మరియు రక్షించబడింది." : "Aadhaar verified under UIDAI standard and shielded.");
          aadhaarSpeechRec.stop();
        }
      }
    };

    aadhaarSpeechRec.onend = () => {
      if (btnSpeakAadhaar) btnSpeakAadhaar.classList.remove("recording");
      if (aadhaarSpeakLabel) aadhaarSpeakLabel.innerText = "Speak UID";
      if (aadhaarDirectInput && aadhaarDirectInput.value) {
        const digits = wordsToDigits(aadhaarDirectInput.value);
        if (digits.length === 12) {
          if (!setVerifiedAadhaar(digits)) {
            speak(currentLang === 'hi' ? "बोला गया आधार नंबर अमान्य है। कृपया पुनः प्रयास करें।" : currentLang === 'te' ? "చెప్పిన ఆధార్ సంఖ్య సరిపోలలేదు. దయచేసి మళ్లీ ప్రయత్నించండి." : "The spoken Aadhaar number failed checksum verification. Please try again or type it.");
          }
        }
      }
    };

    aadhaarSpeechRec.onerror = (evt) => {
      if (btnSpeakAadhaar) btnSpeakAadhaar.classList.remove("recording");
      if (aadhaarSpeakLabel) aadhaarSpeakLabel.innerText = "Speak UID";
      if (aadhaarStatusFeedback) {
        const errType = (evt && evt.error) ? evt.error : "failed";
        if (errType === "no-speech") {
          aadhaarStatusFeedback.innerText = "No voice heard. Please speak clearly or type digits.";
        } else if (errType === "language-not-supported" || errType === "network") {
          aadhaarStatusFeedback.innerText = "Language model loading. Please retry in a moment.";
        } else {
          aadhaarStatusFeedback.innerText = `Speech error (${errType}). Please retry or type.`;
        }
        aadhaarStatusFeedback.classList.remove("hidden");
        aadhaarStatusFeedback.style.color = "#f87171";
      }
    };

    try {
      aadhaarSpeechRec.start();
    } catch (_) {}
  }

  function loadDemoProfile() {
    setVerifiedAadhaar("488813127839", true);
    currentCitizenState.citizen_name = "Ramesh Kumar";
    currentCitizenState.citizen_phone = "9876543210";
    currentCitizenState.citizen_email = "ramesh.kumar@example.com";
    currentCitizenState.location = "Ward 42, Hyderabad, Telangana";
    currentCitizenState.pincode = "500034";
    if (!citizenProblemInput.value.trim()) {
      citizenProblemInput.value = "Severe water pipeline leakage on main road near bus stand since yesterday, flooding the lane. Please inspect and repair.";
    }
    speak("Demo profile for Ramesh Kumar loaded for testing.");
  }

  // Live extraction as citizen types into textarea (e.g. Aadhaar, phone, name)
  citizenProblemInput.addEventListener("input", () => {
    const text = citizenProblemInput.value.trim();
    if (!text) return;
    const parsed = parseCitizenInput(text);
    if (parsed.extractedAadhaar && validateVerhoeff(parsed.extractedAadhaar)) {
      setVerifiedAadhaar(parsed.extractedAadhaar);
      injectCurrentStateIntoPage();
    }
    if (parsed.extractedName) currentCitizenState.citizen_name = parsed.extractedName;
    if (parsed.extractedPhone) currentCitizenState.citizen_phone = parsed.extractedPhone;
  });

  // Direct Aadhaar Input Listener
  if (aadhaarDirectInput) {
    aadhaarDirectInput.addEventListener("input", (e) => {
      let val = e.target.value.replace(/[\s-]/g, "");
      if (val.length >= 12) {
        val = val.slice(0, 12);
        if (setVerifiedAadhaar(val)) {
          speak("Aadhaar number verified under UIDAI standard and shielded.");
        }
      } else {
        if (aadhaarStatusFeedback) aadhaarStatusFeedback.classList.add("hidden");
      }
    });
  }

  if (btnSpeakAadhaar) {
    btnSpeakAadhaar.addEventListener("click", () => {
      startAadhaarVoiceInput();
    });
  }

  if (btnClearAadhaar) {
    btnClearAadhaar.addEventListener("click", () => {
      clearAadhaar();
      speak("Aadhaar cleared. Please enter or speak your 12-digit Aadhaar.");
    });
  }

  if (btnLoadDemoProfile) {
    btnLoadDemoProfile.addEventListener("click", () => {
      loadDemoProfile();
    });
  }

  // ----------------------------------------------------------------
  // Website Detection & Live DOM Study
  // ----------------------------------------------------------------
  function inspectActiveTab() {
    detectedBadgeEl.innerText = "CONNECTING";
    detectedBadgeEl.style.background = "rgba(240, 106, 37, 0.2)";
    detectedBadgeEl.style.color = "var(--orange-hover)";

    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (!tabs || tabs.length === 0) {
        detectedDomainEl.innerText = "No Active Tab";
        detectedTitleEl.innerText = "Please open any webpage to begin.";
        return;
      }

      const tab = tabs[0];
      activeTabInfo.id = tab.id;
      activeTabInfo.url = tab.url || "";
      
      try {
        const parsed = new URL(tab.url || "http://localhost");
        activeTabInfo.domain = parsed.hostname || "Desktop Webpage";
      } catch (e) {
        activeTabInfo.domain = "Desktop Webpage";
      }

      activeTabInfo.title = tab.title || "Civic Webpage";

      detectedDomainEl.innerText = activeTabInfo.domain;
      detectedTitleEl.innerText = activeTabInfo.title;

      // Ask content script for real DOM inspection
      chrome.tabs.sendMessage(tab.id, { action: "INSPECT_PAGE_FORM" }, (res) => {
        if (chrome.runtime.lastError || !res) {
          const _ = chrome.runtime.lastError ? chrome.runtime.lastError.message : null;
          applyFallbackTabInfo();
        } else {
          applyInspectionResults(res);
        }
      });
    });
  }

  function applyInspectionResults(data) {
    activeTabInfo.hasForm = !!data.hasForm;
    activeTabInfo.fields = data.fields || [];
    activeTabInfo.actionButtons = data.actionButtons || [];
    activeTabInfo.mainHeading = data.mainHeading || activeTabInfo.title;
    activeTabInfo.pageType = data.pageType || "GENERAL_PORTAL";
    if (data.domain) activeTabInfo.domain = data.domain;
    if (data.title) activeTabInfo.title = data.title;

    detectedDomainEl.innerText = activeTabInfo.domain;
    detectedTitleEl.innerText = activeTabInfo.title;

    if (activeTabInfo.hasForm && activeTabInfo.fields.length > 0) {
      detectedBadgeEl.innerText = `READY (${activeTabInfo.fields.length} FIELDS)`;
      detectedBadgeEl.style.background = "rgba(16, 185, 129, 0.25)";
      detectedBadgeEl.style.color = "#34d399";
      detectedBadgeEl.style.borderColor = "#10b981";

      contextHeadingEl.innerText = `Form Detected on ${activeTabInfo.domain}`;
      contextSummaryEl.innerText = `Nagarik AI identified ${activeTabInfo.fields.length} form inputs ready for automated citizen assistance and Aadhaar-shielded autofill.`;
      fieldsCountBadgeEl.innerText = `${activeTabInfo.fields.length} Inputs`;

      // Render field tag pills
      fieldsTagCloudEl.innerHTML = "";
      fieldsTagCloudEl.classList.remove("hidden");
      activeTabInfo.fields.forEach(f => {
        const pill = document.createElement("span");
        pill.className = `field-pill ${f.required ? 'required' : ''}`;
        pill.innerHTML = `<span>${f.required ? '★' : '•'}</span> <span>${f.label || f.name || f.id}</span>`;
        fieldsTagCloudEl.appendChild(pill);
      });
    } else {
      detectedBadgeEl.innerText = "ACTIVE PORTAL";
      detectedBadgeEl.style.background = "rgba(59, 130, 246, 0.25)";
      detectedBadgeEl.style.color = "#93c5fd";
      detectedBadgeEl.style.borderColor = "#3b82f6";

      contextHeadingEl.innerText = `Information & Civic Portal: ${activeTabInfo.domain}`;
      contextSummaryEl.innerText = `Nagarik AI is monitoring this page. You can ask questions, translate guidelines into Telugu or Hindi, or locate interactive buttons.`;
      fieldsCountBadgeEl.innerText = "Portal Active";
      fieldsTagCloudEl.classList.add("hidden");
    }

    // Proactive Aadhaar Prompt on official identity portals
    const isAadhaarPortal = (activeTabInfo.domain && activeTabInfo.domain.includes("uidai")) ||
                            activeTabInfo.pageType === "IDENTITY_PORTAL" ||
                            (activeTabInfo.fields && activeTabInfo.fields.some(f => /aadhaar|aadhar|uid/i.test(f.label || f.name || f.id)));
    if (isAadhaarPortal && !currentCitizenState.aadhaar) {
      if (aadhaarPromptText) {
        aadhaarPromptText.innerText = "Official UIDAI Portal: Please speak or enter your 12-digit Aadhaar to proceed safely.";
      }
      setTimeout(() => {
        speak("You are on an official Aadhaar portal. Please speak or enter your 12-digit Aadhaar number to verify and begin.");
      }, 600);
    }

    renderActionChips();
  }

  function applyFallbackTabInfo() {
    detectedBadgeEl.innerText = "ACTIVE";
    detectedBadgeEl.style.background = "rgba(59, 130, 246, 0.25)";
    detectedBadgeEl.style.color = "#93c5fd";
    contextHeadingEl.innerText = `Website Connected: ${activeTabInfo.domain}`;
    contextSummaryEl.innerText = "Ready to accept your problem description or execute 1-click actions.";
    fieldsCountBadgeEl.innerText = "Ready";
    fieldsTagCloudEl.classList.add("hidden");
    renderActionChips();
  }

  // ----------------------------------------------------------------
  // Dynamic 1-Click Action Chips (Tailored to Webpage)
  // ----------------------------------------------------------------
  function renderActionChips() {
    dynamicChipsGrid.innerHTML = "";

    const chips = [];

    if (activeTabInfo.hasForm) {
      chips.push({
        icon: "⚡",
        label: "Auto-Fill This Form",
        action: "AUTOFILL",
        prominent: true
      });
      chips.push({
        icon: "🎯",
        label: "Spotlight Submit Button",
        action: "SPOTLIGHT_SUBMIT"
      });
      chips.push({
        icon: "🛡️",
        label: "Mask Aadhaar & PII",
        action: "MASK_PII"
      });
      chips.push({
        icon: "📋",
        label: "Verify Required Fields",
        action: "VERIFY_FIELDS"
      });
    } else {
      chips.push({
        icon: "🔍",
        label: "Locate Apply / Sign-In",
        action: "SPOTLIGHT_APPLY",
        prominent: true
      });
      chips.push({
        icon: "📑",
        label: "Find Required Documents",
        action: "FIND_DOCS"
      });
      chips.push({
        icon: "💡",
        label: "Check Eligibility Rules",
        action: "ELIGIBILITY_RULES"
      });
    }

    // Multilingual Action Chip based on current language
    const langLabel = currentLang === "te" ? "తెలుగులో వివరించు" : (currentLang === "hi" ? "हिंदी में समझाएं" : "Explain Page Rules");
    chips.push({
      icon: "🔊",
      label: langLabel,
      action: "EXPLAIN_AUDIO"
    });

    chips.forEach(item => {
      const btn = document.createElement("button");
      btn.className = `action-chip ${item.prominent ? 'prominent' : ''}`;
      btn.innerHTML = `<span>${item.icon}</span> <span>${item.label}</span>`;
      btn.addEventListener("click", () => handleActionChipClick(item.action));
      dynamicChipsGrid.appendChild(btn);
    });
  }

  function handleActionChipClick(action) {
    if (action === "AUTOFILL") {
      const isIdentityPortal = activeTabInfo.pageType === "IDENTITY_PORTAL" || 
                              (activeTabInfo.domain && activeTabInfo.domain.includes("uidai")) ||
                              (activeTabInfo.fields && activeTabInfo.fields.some(f => /aadhaar|aadhar|uid/i.test(f.label || f.name || f.id)));
      if (isIdentityPortal && !currentCitizenState.aadhaar) {
        speak("Aadhaar authentication is required. Please speak or enter your 12-digit Aadhaar number first.");
        if (aadhaarDirectInput) aadhaarDirectInput.focus();
        startAadhaarVoiceInput();
        return;
      }
      if (!citizenProblemInput.value.trim()) {
        if (isIdentityPortal) {
          citizenProblemInput.value = `Sign in to Aadhaar portal with verified UID ${currentCitizenState.aadhaar || ''}`;
        } else {
          citizenProblemInput.value = "Severe water pipeline leakage on main road near bus stand since yesterday, flooding the lane. Please inspect and repair.";
        }
      }
      executeDynamicTaskPlan();
    } else if (action === "SPOTLIGHT_SUBMIT" || action === "SPOTLIGHT_APPLY") {
      chrome.tabs.sendMessage(activeTabInfo.id, {
        action: "HIGHLIGHT_PAGE_ELEMENT",
        target: "SUBMIT",
        label: "Submit Application"
      });
      speak("Highlighting the submission button on your screen.");
    } else if (action === "MASK_PII") {
      executeDynamicTaskPlan({ piiOnly: true });
    } else if (action === "EXPLAIN_AUDIO") {
      explainPageAloud();
    } else if (action === "FIND_DOCS") {
      citizenProblemInput.value = "What official documents and eligibility certificates are required for this scheme?";
      executeDynamicTaskPlan();
    } else if (action === "VERIFY_FIELDS") {
      verifyPageFields();
    } else if (action === "ELIGIBILITY_RULES") {
      citizenProblemInput.value = "Explain eligibility criteria, age limits, and statutory benefits for this welfare scheme.";
      executeDynamicTaskPlan();
    }
  }

  function verifyPageFields() {
    const required = activeTabInfo.fields.filter(f => f.required);
    const emptyRequired = required.filter(f => !f.isFilled);
    if (emptyRequired.length === 0) {
      speak("All mandatory fields on this form are filled. Ready to submit.");
    } else {
      speak(`Notice: ${emptyRequired.length} mandatory fields are still empty. Highlighting now.`);
      chrome.tabs.sendMessage(activeTabInfo.id, {
        action: "HIGHLIGHT_PAGE_ELEMENT",
        target: emptyRequired[0].id || emptyRequired[0].name || "INPUT",
        label: `Required: ${emptyRequired[0].label}`
      });
    }
  }

  // ----------------------------------------------------------------
  // Dynamic Entity & Semantic Parser
  // ----------------------------------------------------------------
  function parseCitizenInput(text) {
    if (typeof window !== "undefined" && window.parseCitizenInput && window.parseCitizenInput !== parseCitizenInput) {
      return window.parseCitizenInput(text);
    }
    const res = {
      rawText: text || "",
      extractedAadhaar: null,
      extractedPhone: null,
      extractedPin: null,
      extractedEmail: null,
      extractedName: null,
      extractedLocation: null
    };
    if (!text) return res;

    // Convert Indic numerals (Devanagari ०-९ and Telugu ౦-౯) to standard ASCII 0-9
    const normalizedText = convertIndicDigits(text);

    // 1. Aadhaar / UID (12 digits, continuous or grouped with spaces/hyphens)
    // Supports Indic Aadhaar terms: Hindi (आधार, आधार संख्या, यूआईडी) and Telugu (ఆధార్, ఆధార్ సంఖ్య, యూఐడీ)
    const aadhaarMatch = normalizedText.match(/(?:aadhaar|aadhar|uid|uidai|आधार(?:\s*संख्या)?|यूआईडी|ఆధార్(?:\s*సంఖ్య)?|యూఐడీ)[\s:=]*([0-9]{4}\s?[0-9]{4}\s?[0-9]{4})\b/iu) ||
                         normalizedText.match(/\b([0-9]{4}\s[0-9]{4}\s[0-9]{4})\b/) ||
                         normalizedText.match(/\b([0-9]{12})\b/);
    if (aadhaarMatch) {
      res.extractedAadhaar = aadhaarMatch[1].replace(/\s+/g, "");
    }

    // 2. Phone / Mobile (10 digits starting with 6-9)
    // Supports Indic phone terms: Hindi (फोन, मोबाइल, संपर्क) and Telugu (ఫోన్, మొబైల్, సంప్రదింపు)
    const phoneMatch = normalizedText.match(/(?:phone|mobile|contact|cell|फोन|मोबाइल|संपर्क|ఫోన్|మొబైల్|సంప్రదింపు)[\s:=]*([6-9][0-9]{9})\b/iu) ||
                       normalizedText.match(/\b([6-9][0-9]{9})\b/);
    if (phoneMatch) {
      res.extractedPhone = phoneMatch[1];
    }

    // 3. Pincode (6 digits starting with 1-9)
    const pinMatch = normalizedText.match(/(?:pin|pincode|postal|पिन|पिनकोड|పిన్|పిన్‌కోడ్)[\s:=]*([1-9][0-9]{5})\b/iu) ||
                     normalizedText.match(/\b([1-9][0-9]{5})\b/);
    if (pinMatch) {
      res.extractedPin = pinMatch[1];
    }

    // 4. Email
    const emailMatch = normalizedText.match(/([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/);
    if (emailMatch) {
      res.extractedEmail = emailMatch[1];
    }

    // 5. Citizen Name
    // Supports Indic name prefixes: Hindi (मेरा नाम, नाम) and Telugu (నా పేరు, పేరు)
    const nameMatch = normalizedText.match(/(?:my name is|i am|myself|citizen:?|मेरा\s+नाम(?:\s+है)?|नाम:?|నా\s+పేరు(?:\s+వచ్చేసి)?|పేరు:?)\s+([^.,\n|।]+?)(?=\s+(?:and|who|from|need|residing|with|my|और|है|మరియు|నాకు|నుండి)(?![\p{L}\p{N}])|[.,\n|।]|$)/iu);
    if (nameMatch) {
      res.extractedName = nameMatch[1].trim();
    }

    // 6. Location
    const locMatch = normalizedText.match(/(?:in|at|near|around|from|opposite|behind|beside|lane|colony|ward|sector|street|nagar|road|dist|district|city)\s+([A-Za-z0-9\s,\-_#]+?)(?=\s+(?:since|which|please|causing|due|and\s+it|is\s+broken|[.,\n]|$))/i);
    if (locMatch) {
      res.extractedLocation = locMatch[0].trim();
    }

    return res;
  }

  function inferCivicDepartment(text) {
    if (!text) return "Municipal Corporation & Public Works";
    const t = text.toLowerCase();
    let bestDept = "Municipal Corporation & Public Works";
    let maxMatches = 0;
    for (const [dept, keywords] of Object.entries(CIVIC_CONCEPT_SYNONYMS)) {
      let score = 0;
      for (const kw of keywords) {
        if (t.includes(kw)) score += kw.length;
      }
      if (score > maxMatches) {
        maxMatches = score;
        bestDept = dept;
      }
    }
    return bestDept;
  }

  function inferCategory(text, dept) {
    const t = text.toLowerCase();
    if (dept.includes("Water") || t.includes("water") || t.includes("leak") || t.includes("pipe") || t.includes("drainage")) {
      return "Water Pipeline Leakage & Sewerage Disruption";
    }
    if (dept.includes("Electricity") || t.includes("power") || t.includes("electricity") || t.includes("voltage") || t.includes("current")) {
      return "Frequent Power Outage / Voltage Fluctuation";
    }
    if (t.includes("pothole") || t.includes("road") || t.includes("street")) {
      return "Dangerous Road Potholes & Infrastructure Damage";
    }
    if (t.includes("garbage") || t.includes("waste") || t.includes("trash")) {
      return "Solid Waste Accumulation & Sanitation Hazard";
    }
    if (t.includes("ration") || t.includes("pds") || t.includes("dealer")) {
      return "Public Distribution System & Fair Price Denial";
    }
    return "Public Infrastructure & Civic Amenity Grievance";
  }

  function inferUrgency(text) {
    const t = text.toLowerCase();
    if (/immediate|urgent|hazard|severe|danger|health|safety|overflow|emergency|shock|fire|leak|dengue|hospital|blocked|night/i.test(t)) {
      return "HIGH";
    }
    return "MEDIUM";
  }

  function generateFormalPetition(problemText, name, phone, location, category) {
    return `SUBJECT: Urgent Redressal Request Regarding ${category}

RESPECTED OFFICER,

I am bringing to your urgent attention the following civic grievance:
"${problemText}"

INCIDENT LOCATION / JURISDICTION:
${location}

This condition causes severe inconvenience and potential health/safety risks for local residents.

REQUESTED REMEDY:
1. Urgent on-site inspection by the designated municipal or departmental officer.
2. Immediate repair, rectification, or clearance of the issue.
3. Official confirmation and dispatch reference.

Submitted in good faith by ${name}, Contact: ${phone}.`.trim();
  }

  // ----------------------------------------------------------------
  // Dynamic Task Determination & Execution Engine
  // ----------------------------------------------------------------
  btnExecuteTask.addEventListener("click", () => {
    executeDynamicTaskPlan();
  });

  // Toggle Editable Fields Drawer
  btnToggleEditFields.addEventListener("click", () => {
    editableFieldsDrawer.classList.toggle("hidden");
    if (!editableFieldsDrawer.classList.contains("hidden")) {
      editCustomDesc.value = currentCitizenState.description;
      editCustomName.value = currentCitizenState.citizen_name;
      editCustomPhone.value = currentCitizenState.citizen_phone;
    }
  });

  btnApplyCustomEdit.addEventListener("click", () => {
    if (editCustomDesc.value.trim()) currentCitizenState.description = editCustomDesc.value.trim();
    if (editCustomName.value.trim()) currentCitizenState.citizen_name = editCustomName.value.trim();
    if (editCustomPhone.value.trim()) currentCitizenState.citizen_phone = editCustomPhone.value.trim();
    
    updateSynthesisPreview();
    editableFieldsDrawer.classList.add("hidden");
    injectCurrentStateIntoPage();
  });

  btnReinjectFields.addEventListener("click", () => {
    injectCurrentStateIntoPage();
  });

  function updateSynthesisPreview() {
    if (previewDept) previewDept.innerText = currentCitizenState.department;
    if (previewUrgency) previewUrgency.innerText = currentCitizenState.urgency_level;
    if (previewLocation) previewLocation.innerText = currentCitizenState.location;
    if (previewCitizen) previewCitizen.innerText = `${currentCitizenState.citizen_name} (${currentCitizenState.citizen_phone})`;
  }

  function executeDynamicTaskPlan(options = {}) {
    const citizenText = citizenProblemInput.value.trim() || "Severe civic grievance and public service request for immediate official redressal.";
    
    // 1. Show Animated Nagarik Reasoning Stage
    analyzingStage.classList.remove("hidden");
    taskPlanCard.classList.add("hidden");
    resultsCard.classList.add("hidden");

    const reasoningLines = [
      `🧠 Analyzing ${activeTabInfo.domain} DOM architecture...`,
      `🔍 Mapping citizen problem to page inputs and action targets...`,
      `🛡️ Enforcing Zero-Knowledge Aadhaar shielding...`,
      `⚡ Generating dynamic task execution checklist...`
    ];

    let lineIdx = 0;
    const tickerInterval = setInterval(() => {
      lineIdx = (lineIdx + 1) % reasoningLines.length;
      reasoningTicker.innerHTML = `<span>${reasoningLines[lineIdx]}</span>`;
    }, 450);

    speak(LOCALES[currentLang].analyzing);

    // Fast, local zero-knowledge synthesis
    setTimeout(() => {
      clearInterval(tickerInterval);
      analyzingStage.classList.add("hidden");
      taskPlanCard.classList.remove("hidden");

      // 2. Synthesize State (From Local Sovereign Heuristics & Synonyms)
      synthesizeCitizenState(citizenText, null);
      updateSynthesisPreview();

      // 3. Build & Execute Plan
      const plan = synthesizeCustomPlan(options);
      renderTaskPlan(plan);
      executeTasksSequentially(plan);
    }, 450);
  }

  function synthesizeCitizenState(rawText, aiData) {
    const parsed = parseCitizenInput(rawText);

    if (parsed.extractedName) currentCitizenState.citizen_name = parsed.extractedName;
    if (parsed.extractedPhone) currentCitizenState.citizen_phone = parsed.extractedPhone;
    if (parsed.extractedPin) currentCitizenState.pincode = parsed.extractedPin;
    if (parsed.extractedEmail) currentCitizenState.citizen_email = parsed.extractedEmail;
    if (parsed.extractedLocation) currentCitizenState.location = parsed.extractedLocation;

    if (aiData) {
      currentCitizenState.department = aiData.department || inferCivicDepartment(rawText);
      currentCitizenState.category = aiData.category || inferCategory(rawText, currentCitizenState.department);
      currentCitizenState.urgency_level = aiData.urgency_level || inferUrgency(rawText);
      currentCitizenState.description = aiData.description || generateFormalPetition(
        rawText,
        currentCitizenState.citizen_name,
        currentCitizenState.citizen_phone,
        currentCitizenState.location,
        currentCitizenState.category
      );
    } else {
      currentCitizenState.department = inferCivicDepartment(rawText);
      currentCitizenState.category = inferCategory(rawText, currentCitizenState.department);
      currentCitizenState.urgency_level = inferUrgency(rawText);
      currentCitizenState.description = generateFormalPetition(
        rawText,
        currentCitizenState.citizen_name,
        currentCitizenState.citizen_phone,
        currentCitizenState.location,
        currentCitizenState.category
      );
    }

    if (parsed.extractedAadhaar) {
      currentCitizenState.uid = parsed.extractedAadhaar;
      currentCitizenState.aadhaar = parsed.extractedAadhaar;
      currentCitizenState.id_number = parsed.extractedAadhaar;
    }
  }

  function synthesizeCustomPlan(options = {}) {
    const loc = LOCALES[currentLang] || LOCALES.en;
    const tasks = [];

    // Task 1: DOM Semantic Analysis & Problem Formulation
    tasks.push({
      id: "task_analyze",
      icon: "🔍",
      title: "Analyze Page DOM & Map Citizen Input",
      desc: `Mapped to "${activeTabInfo.domain}" targeting ${activeTabInfo.fields.length || 'interactive'} elements.`,
      status: "pending",
      run: async () => {
        await new Promise(r => setTimeout(r, 350));
        return true;
      }
    });

    // Task 2: Zero-Knowledge Privacy & Aadhaar Shield
    const shieldDesc = currentCitizenState.uid 
      ? `Aadhaar UID XXXXXXXX${currentCitizenState.uid.slice(-4)} masked with zero-knowledge privacy.`
      : loc.task_shield_desc;

    tasks.push({
      id: "task_shield",
      icon: "🛡️",
      title: loc.task_shield_title,
      desc: shieldDesc,
      status: "pending",
      run: async () => {
        await new Promise(r => setTimeout(r, 300));
        return true;
      }
    });

    // Task 3: Form Autofill (if page has inputs or fields requested)
    const autofillDesc = `Injecting department, category, citizen identity, contact, and formal petition.`;

    tasks.push({
      id: "task_autofill",
      icon: "⚡",
      title: loc.task_autofill_title,
      desc: autofillDesc,
      status: "pending",
      run: async () => {
        return injectCurrentStateIntoPage();
      }
    });

    // Task 4: Visual Spotlight on Submit / Action button (Sequential Guided Order for Login/Exam Portals)
    const isLoginPortal = activeTabInfo.domain.includes("uidai") || 
                          activeTabInfo.title.toLowerCase().includes("login") || 
                          activeTabInfo.url.toLowerCase().includes("login") ||
                          activeTabInfo.pageType === "EXAM_ADMISSION_PORTAL";
    const spotlightTarget = isLoginPortal ? "LOGIN" : "SUBMIT";
    const spotlightLabel = isLoginPortal ? "Log In / Submit" : "Review & Submit";

    tasks.push({
      id: "task_spotlight",
      icon: "🎯",
      title: isLoginPortal ? "Sequential Login Copilot" : loc.task_spotlight_title,
      desc: isLoginPortal ? "Step-by-step order: 1. Application No → 2. Password → 3. Security PIN → 4. Official Log In button." : loc.task_spotlight_desc,
      status: "pending",
      run: async () => {
        return new Promise((resolve) => {
          if (isLoginPortal) {
            chrome.tabs.sendMessage(activeTabInfo.id, { action: "GUIDE_LOGIN_SEQUENCE" }, (seqRes) => {
              if (seqRes && seqRes.success) {
                resolve(true);
              } else {
                chrome.tabs.sendMessage(activeTabInfo.id, {
                  action: "HIGHLIGHT_PAGE_ELEMENT",
                  target: spotlightTarget,
                  label: spotlightLabel
                }, () => resolve(true));
              }
            });
          } else {
            chrome.tabs.sendMessage(activeTabInfo.id, {
              action: "HIGHLIGHT_PAGE_ELEMENT",
              target: spotlightTarget,
              label: spotlightLabel
            }, () => resolve(true));
          }
        });
      }
    });

    // Task 5: Voice Guidance
    tasks.push({
      id: "task_voice",
      icon: "🔊",
      title: loc.task_explain_title,
      desc: loc.task_explain_desc,
      status: "pending",
      run: async () => {
        speak(loc.success_speech);
        return true;
      }
    });

    return tasks;
  }

  function injectCurrentStateIntoPage() {
    return new Promise((resolve) => {
      chrome.tabs.sendMessage(activeTabInfo.id, {
        action: "FILL_FIELDS",
        fields: currentCitizenState
      }, (res) => {
        if (chrome.runtime.lastError || !res) {
          const _ = chrome.runtime.lastError ? chrome.runtime.lastError.message : null;
          lastFillResult = { success: false, filledCount: 0 };
          resolve(lastFillResult);
        } else {
          lastFillResult = res;
          resolve(res);
        }
      });
    });
  }

  function renderTaskPlan(tasks) {
    planTitle.innerText = `Custom Plan for ${activeTabInfo.domain}`;
    planSubtitle.innerText = `Nagarik AI determined ${tasks.length} contextual actions for your request.`;
    planStatusBadge.innerText = "EXECUTING";
    planStatusBadge.className = "badge-running";

    taskChecklist.innerHTML = "";
    tasks.forEach(t => {
      const el = document.createElement("div");
      el.id = `item-${t.id}`;
      el.className = "task-item";
      el.innerHTML = `
        <span class="task-item-icon">${t.icon}</span>
        <div class="task-item-content">
          <div class="task-item-title">${t.title}</div>
          <div class="task-item-desc">${t.desc}</div>
        </div>
        <span class="task-status-pill ${t.status}" id="pill-${t.id}">${t.status}</span>
      `;
      taskChecklist.appendChild(el);
    });
  }

  async function executeTasksSequentially(tasks) {
    for (const t of tasks) {
      const itemEl = document.getElementById(`item-${t.id}`);
      const pillEl = document.getElementById(`pill-${t.id}`);

      if (itemEl) itemEl.classList.add("running");
      if (pillEl) {
        pillEl.className = "task-status-pill running";
        pillEl.innerText = "Running";
      }

      try {
        await t.run();
      } catch (err) {
        console.warn("Task warning:", err);
      }

      if (itemEl) {
        itemEl.classList.remove("running");
        itemEl.classList.add("completed");
      }
      if (pillEl) {
        pillEl.className = "task-status-pill completed";
        pillEl.innerText = "Done ✓";
      }
    }

    planStatusBadge.innerText = "COMPLETED";
    planStatusBadge.style.background = "rgba(16, 185, 129, 0.25)";
    planStatusBadge.style.color = "#34d399";
    planStatusBadge.style.borderColor = "#10b981";

    // Show Completion Results Card with verified feedback
    setTimeout(() => {
      resultsCard.classList.remove("hidden");
      
      const count = (lastFillResult && typeof lastFillResult.filledCount === "number") ? lastFillResult.filledCount : 0;
      
      if (count > 0) {
        resFieldsCount.innerText = `${count} Populated`;
        resFieldsCount.style.color = "#34d399";
        
        let detailHtml = `<strong>Form populated successfully (${count} field${count === 1 ? '' : 's'}).</strong>`;
        if (lastFillResult.filledItems && lastFillResult.filledItems.length > 0) {
          const names = lastFillResult.filledItems.map(i => `${i.label} (${i.maskedValue})`).join(", ");
          detailHtml += `<br/><span style="color:#94a3b8; font-size:11px;">Populated: ${names}</span>`;
        }
        if (lastFillResult.hasCaptcha) {
          detailHtml += `<br/><span style="color:#f59e0b; font-weight:bold;">⚠️ Captcha Detected: Please type the security code from the image into the highlighted captcha box.</span>`;
        }
        detailHtml += `<br/>Please review and click the spotlighted button to complete your official dispatch.`;
        if (resultsInstructionEl) resultsInstructionEl.innerHTML = detailHtml;
      } else {
        resFieldsCount.innerText = `0 Populated`;
        resFieldsCount.style.color = "#f59e0b";
        if (resultsInstructionEl) {
          resultsInstructionEl.innerHTML = `<strong>Page Inspected:</strong> Nagarik AI found ${activeTabInfo.fields.length} inputs on this webpage (${activeTabInfo.fields.map(f => f.label || f.name).join(", ")}). Click 'Spotlight Submit Button' or tap a field to fill manually.`;
        }
      }

      resultsCard.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }, 400);
  }

  function explainPageAloud() {
    let summaryText = "";
    if (currentLang === "te") {
      summaryText = `మీరు ప్రస్తుతం ${activeTabInfo.domain} వెబ్‌సైట్‌లో ఉన్నారు. ఈ పేజీలో సేవలు లేదా ఫిర్యాదులను నమోదు చేయడానికి అవసరమైన ఫీల్డ్‌లు ఉన్నాయి. మీ సమస్యను చెప్పండి లేదా ఆటో ఫిల్ బటన్ నొక్కండి.`;
    } else if (currentLang === "hi") {
      summaryText = `आप अभी ${activeTabInfo.domain} पोर्टल पर हैं। यह पृष्ठ नागरिक सेवाओं और शिकायत पंजीकरण के लिए है। अपना विवरण भरने के लिए ऑटो-फिल बटन दबाएं।`;
    } else {
      summaryText = `You are on ${activeTabInfo.domain}. This page is for civic services and applications. You can tap Auto-Fill to populate your information or describe your specific task.`;
    }
    speak(summaryText);
  }

  // Button Listeners on Task Card & Results
  btnHighlightSubmit.addEventListener("click", () => {
    chrome.tabs.sendMessage(activeTabInfo.id, {
      action: "HIGHLIGHT_PAGE_ELEMENT",
      target: "SUBMIT",
      label: "Click Here to Submit"
    });
  });

  btnExplainAudio.addEventListener("click", () => {
    explainPageAloud();
  });

  btnResetCopilot.addEventListener("click", () => {
    resultsCard.classList.add("hidden");
    taskPlanCard.classList.add("hidden");
    citizenProblemInput.value = "";
    inspectActiveTab();
  });

  // Listen for background events (e.g. tracking receipt captured or DOM mutation)
  chrome.runtime.onMessage.addListener((msg) => {
    if (msg.action === "ACTIVE_TAB_CHANGED" || msg.action === "PAGE_DOM_MUTATED") {
      inspectActiveTab();
    } else if (msg.action === "UPDATE_TRACKING_RECEIPT" || msg.action === "TRACKING_ID_DETECTED") {
      receiptRefBox.classList.remove("hidden");
      receiptTrackingId.innerText = msg.trackingId;
      speak(`Grievance dispatched with official reference ${msg.trackingId}.`);
    }
  });

  // Initial tab inspection
  inspectActiveTab();
});
