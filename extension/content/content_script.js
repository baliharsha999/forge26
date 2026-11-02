/**
 * Nagarik AI - Universal Civic Content Script
 * Injected into supported civic portals to provide assistive form inspection, zero-knowledge PII shielding, and guided citizen workflows.
 */
(() => {
  if (typeof window !== "undefined" && window.__nagarikContentLoaded) return;
  if (typeof window !== "undefined") window.__nagarikContentLoaded = true;
  let activeBanner = null;

  // Civic Concept Synonym Graph for High-Precision Dropdown and Department Matching
  const CIVIC_CONCEPT_SYNONYMS = {
    "Water Supply & Sewerage Board": [
      "water", "sewerage", "drainage", "pipe", "pipeline", "tap", "leakage", "drain", "sewage", "jal", "neellu", "paani", "manhole", "water supply", "drinking water"
    ],
    "State Electricity Distribution Company (DISCOM)": [
      "electricity", "power", "discom", "current", "voltage", "transformer", "wire", "pole", "meter", "bijli", "vidyut", "blackout", "power cut", "eb", "bescom", "tsspdcl", "tneb", "mseb", "light"
    ],
    "Municipal Corporation & Public Works": [
      "road", "pothole", "pavement", "street", "footpath", "bridge", "public works", "pwd", "highway", "traffic", "building", "encroachment", "tree", "tar road", "asphalt", "culvert"
    ],
    "Solid Waste Management & Public Health": [
      "waste", "garbage", "solid waste", "sanitation", "cleanliness", "trash", "kuda", "debris", "mosquitoes", "fogging", "sweeping", "dump", "bin", "litter", "drain cleaning"
    ],
    "Civil Supplies & Consumer Affairs": [
      "ration", "civil supplies", "consumer", "pds", "fair price", "food grain", "subsidy", "dealer", "ration card", "quota", "ration shop"
    ]
  };

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

  function showBanner(text, isDone = false, filledCount = 0) {
    if (!activeBanner) {
      activeBanner = document.createElement("div");
      activeBanner.id = "jansetu-form-filling-banner";
      document.body.appendChild(activeBanner);
    }
    
    activeBanner.innerHTML = `
      <div class="${isDone ? '' : 'jansetu-spinner'}"></div>
      <div style="flex: 1;">
        <div style="font-weight: 800; color: #F06A25; font-size: 13px; display: flex; align-items: center; gap: 6px;">
          <span>Nagarik AI</span>
          <span style="font-size: 9px; color: #8F93B5; font-weight: normal; text-transform: uppercase; letter-spacing: 0.5px;">Universal Civic Shield</span>
        </div>
        <div style="color: #E8E9F2; font-size: 11px; margin-top: 2px;">${text}</div>
      </div>
      ${isDone ? `
        <button id="nagarik-hud-spotlight-btn" style="background: #F06A25; color: #0B0C1E; border: none; border-radius: 6px; padding: 4px 10px; font-size: 10px; font-weight: 800; cursor: pointer; white-space: nowrap; margin-left: 8px;">
          👉 Locate Submit
        </button>
        <button id="nagarik-hud-close-btn" style="background: transparent; color: #8F93B5; border: none; font-size: 14px; cursor: pointer; padding: 0 4px; margin-left: 4px;">✕</button>
      ` : ''}
    `;

    if (isDone) {
      const locateBtn = document.getElementById("nagarik-hud-spotlight-btn");
      if (locateBtn) {
        locateBtn.onclick = () => {
          highlightPageElement("SUBMIT", "Review & Submit");
        };
      }
      const closeBtn = document.getElementById("nagarik-hud-close-btn");
      if (closeBtn) {
        closeBtn.onclick = () => {
          if (activeBanner) {
            activeBanner.remove();
            activeBanner = null;
          }
        };
      }

      setTimeout(() => {
        if (activeBanner) {
          activeBanner.style.opacity = "0";
          setTimeout(() => {
            if (activeBanner) activeBanner.remove();
            activeBanner = null;
          }, 400);
        }
      }, 7000);
    }
  }

  /**
   * Deep query selector that traverses regular DOM and Shadow DOM roots
   */
  function querySelectorAllDeep(selector, root = document) {
    let results = [];
    try {
      results = Array.from(root.querySelectorAll(selector));
    } catch (e) {}
    try {
      const treeWalker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT);
      let currentNode = treeWalker.nextNode();
      while (currentNode) {
        if (currentNode.shadowRoot) {
          results = results.concat(querySelectorAllDeep(selector, currentNode.shadowRoot));
        }
        currentNode = treeWalker.nextNode();
      }
    } catch (e) {}
    return results;
  }

  /**
   * Safe native setter to bypass React 16+, Vue, Angular proxy overrides
   */
  function setNativeValue(element, value) {
    if (!element) return false;
    try {
      element.focus();
    } catch (e) {}

    const inputProto = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value")?.set;
    const textareaProto = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, "value")?.set;
    const selectProto = Object.getOwnPropertyDescriptor(window.HTMLSelectElement.prototype, "value")?.set;

    if (element.tagName === "INPUT" && inputProto) {
      inputProto.call(element, value);
    } else if (element.tagName === "TEXTAREA" && textareaProto) {
      textareaProto.call(element, value);
    } else if (element.tagName === "SELECT" && selectProto) {
      selectProto.call(element, value);
    }
    try {
      element.value = value;
    } catch (e) {}

    try {
      element.dispatchEvent(new Event("focus", { bubbles: true }));
      try {
        element.dispatchEvent(new KeyboardEvent("keydown", { bubbles: true, composed: true, key: "0" }));
      } catch (e) {}
      try {
        element.dispatchEvent(new InputEvent("input", { bubbles: true, composed: true, data: String(value) }));
      } catch (ie) {}
      element.dispatchEvent(new Event("input", { bubbles: true, composed: true }));
      element.dispatchEvent(new Event("change", { bubbles: true, composed: true }));
      try {
        element.dispatchEvent(new KeyboardEvent("keyup", { bubbles: true, composed: true, key: "0" }));
      } catch (e) {}
      element.dispatchEvent(new Event("blur", { bubbles: true }));
    } catch (e) {}

    element.classList.add("jansetu-highlight");
    element.style.outline = "2.5px solid #F06A25";
    element.style.boxShadow = "0 0 16px rgba(240, 106, 37, 0.45)";

    try {
      const rect = element.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) {
        const badge = document.createElement("div");
        badge.className = "nagarik-field-autofilled-tag";
        badge.innerText = "✓ Nagarik AI";
        badge.style.position = "absolute";
        badge.style.background = "#10B981";
        badge.style.color = "#0B0C1E";
        badge.style.padding = "2px 6px";
        badge.style.borderRadius = "8px";
        badge.style.fontSize = "9px";
        badge.style.fontWeight = "bold";
        badge.style.zIndex = "9999999";
        badge.style.pointerEvents = "none";
        badge.style.top = Math.max(0, (window.scrollY + rect.top - 18)) + "px";
        badge.style.left = Math.max(0, (window.scrollX + rect.left + 4)) + "px";
        document.body.appendChild(badge);
        setTimeout(() => { badge.remove(); }, 6000);
      }
    } catch (e) {}

    return true;
  }

  /**
   * Extract comprehensive DOM structure from active webpage
   */
  function extractPageDomInfo() {
    const title = document.title || "";
    const url = window.location.href;
    const domain = window.location.hostname || "Desktop Webpage";
    
    // Find main heading
    const h1 = document.querySelector("h1");
    const h2 = document.querySelector("h2");
    const h3 = document.querySelector("h3");
    const mainHeading = h1 ? h1.innerText.trim() : (h2 ? h2.innerText.trim() : (h3 ? h3.innerText.trim() : title));

    // Discover form inputs, textareas, selects
    const inputs = querySelectorAllDeep("input:not([type='hidden']):not([type='submit']):not([type='button']), textarea, select");
    const fields = inputs.map((el, idx) => {
      let label = "";
      if (el.id) {
        const lbl = document.querySelector(`label[for='${el.id}']`);
        if (lbl) label = lbl.innerText.trim();
      }
      if (!label) {
        const parentLbl = el.closest("label");
        if (parentLbl) label = parentLbl.innerText.trim();
      }
      if (!label) {
        label = el.getAttribute("aria-label") || el.getAttribute("placeholder") || el.name || el.id || `field_${idx + 1}`;
      }

      return {
        id: el.id || "",
        name: el.name || "",
        label: label.replace(/\s+/g, " ").trim(),
        placeholder: el.placeholder || "",
        type: el.type || el.tagName.toLowerCase(),
        tagName: el.tagName.toLowerCase(),
        required: el.required || el.getAttribute("aria-required") === "true" || (el.className && el.className.includes("required")),
        value: (el.value || "").trim(),
        isFilled: (el.value || "").trim().length > 0
      };
    });

    const hasForm = fields.length > 0 || !!document.querySelector("form");

    // Discover actionable buttons
    const actionButtons = querySelectorAllDeep("button, input[type='submit'], input[type='button'], a.btn, a.button, [role='button']")
      .filter(el => {
        const rect = el.getBoundingClientRect();
        return rect.width > 0 && rect.height > 0 && el.style.display !== "none" && el.style.visibility !== "hidden";
      })
      .slice(0, 15)
      .map(b => ({
        text: (b.innerText || b.value || b.getAttribute("aria-label") || "Action").replace(/\s+/g, " ").trim(),
        id: b.id || "",
        type: b.type || "button",
        selector: b.id ? `#${b.id}` : (b.name ? `[name='${b.name}']` : b.tagName.toLowerCase())
      }));

    // Classify Page Intent
    let pageType = "GENERAL_PORTAL";
    const textSample = (document.title + " " + mainHeading + " " + (document.body ? document.body.innerText.substring(0, 500) : "")).toLowerCase();
    if (/grievance|complaint|redressal|petition|samadhan|sahaaya|prajavani|cpgrams/i.test(textSample)) {
      pageType = "CIVIC_GRIEVANCE_PORTAL";
    } else if (/scholarship|pension|welfare|yojana|subsidy|ration|pmkisan|sevasindhu/i.test(textSample)) {
      pageType = "WELFARE_SCHEME_PORTAL";
    } else if (/examination|admit card|hall ticket|candidate|roll no|nta|upsc/i.test(textSample)) {
      pageType = "EXAM_ADMISSION_PORTAL";
    } else if (/uidai|aadhaar|update|download|enrolment/i.test(textSample)) {
      pageType = "IDENTITY_PORTAL";
    }

    return {
      title,
      url,
      domain,
      mainHeading,
      hasForm,
      pageType,
      fields,
      actionButtons,
      totalInputs: fields.length
    };
  }

  function isUnwantedButtonOrLink(el) {
    if (!el) return true;
    const txt = (el.innerText || el.value || "").toLowerCase();
    const href = (el.getAttribute("href") || "").toLowerCase();
    const id = (el.id || "").toLowerCase();
    const name = (el.name || "").toLowerCase();
    const aria = (el.getAttribute("aria-label") || "").toLowerCase();
    const combined = `${txt} ${href} ${id} ${name} ${aria}`;
    return combined.includes("register") ||
           combined.includes("signup") ||
           combined.includes("sign up") ||
           combined.includes("new registration") ||
           combined.includes("new candidate") ||
           combined.includes("forgot") ||
           combined.includes("reset password") ||
           combined.includes("officer");
  }

  /**
   * Target Element Finder (by intent, selector, or text, with Shadow DOM support)
   */
  function findTargetElement(target) {
    if (!target) return null;
    if (typeof target === 'object' && target.nodeType) return target;
    const raw = String(target).trim();
    const targetUpper = raw.toUpperCase();
    const targetLower = raw.toLowerCase();

    // 1. Exact CSS selector or direct ID match (deep query)
    if (raw.startsWith(".") || raw.startsWith("#") || raw.startsWith("[") || (raw.includes("[") && raw.includes("]"))) {
      try {
        const found = querySelectorAllDeep(raw)[0];
        if (found) return found;
      } catch (e) {}
    } else {
      try {
        const byId = querySelectorAllDeep(`#${raw}`)[0];
        if (byId) return byId;
      } catch (e) {}
    }

    const allInteractive = querySelectorAllDeep("button, input[type='submit'], input[type='button'], [role='button'], .btn, .button, a");

    // 2. Specific intent mappings (Buttons prioritized over generic links)
    if (targetUpper === "SUBMIT" || targetUpper === "SAVE" || targetUpper === "LODGE" || targetUpper === "APPLY" || targetUpper === "LOGIN" || targetUpper === "OTP" || targetUpper === "SIGN_IN") {
      const realButtons = querySelectorAllDeep("input[type='submit'], input[type='button'], button, [role='button'], .btn, .button");
      
      // Highest priority: exact ID or value matches
      const exactBtn = realButtons.find(el => {
        if (isUnwantedButtonOrLink(el)) return false;
        const txt = (el.innerText || el.value || "").toLowerCase().trim();
        const id = (el.id || "").toLowerCase();
        const name = (el.name || "").toLowerCase();
        return id.includes("btnlogin") || id === "login-btn" || id === "submit-button" || id === "login" ||
               name.includes("btnlogin") || name.includes("login") ||
               txt === "log in" || txt === "login" || txt === "sign in" || txt === "submit";
      });
      if (exactBtn) return exactBtn;

      const foundBtn = realButtons.find(el => {
        if (isUnwantedButtonOrLink(el)) return false;
        const txt = (el.innerText || el.value || "").toLowerCase();
        const id = (el.id || "").toLowerCase();
        const name = (el.name || "").toLowerCase();
        return id.includes("btnlogin") || id.includes("login") || id.includes("submit") || name.includes("login") ||
               txt.includes("login with otp") || txt.includes("send otp") || txt.includes("get otp") ||
               txt.includes("log in") || txt.includes("login") || txt.includes("sign in") ||
               txt.includes("submit grievance") || txt.includes("submit complaint") || txt.includes("lodge grievance") ||
               txt.includes("submit") || txt.includes("lodge") || txt.includes("apply") || txt.includes("save") ||
               txt.includes("proceed");
      });
      if (foundBtn) return foundBtn;

      // Fallback only if no real buttons found and it's not a forbidden link
      const foundLink = allInteractive.find(el => {
        if (isUnwantedButtonOrLink(el)) return false;
        const txt = (el.innerText || el.value || "").toLowerCase();
        const id = (el.id || "").toLowerCase();
        const name = (el.name || "").toLowerCase();
        return id.includes("btnlogin") || id.includes("login") || id.includes("submit") || name.includes("login") ||
               txt.includes("log in") || txt.includes("login") || txt.includes("sign in") ||
               txt.includes("submit") || txt.includes("proceed");
      });
      if (foundLink) return foundLink;
    }

    // 3. Substring match (strictly excluding unwanted registration/forgot links)
    const matched = allInteractive.find(el => {
      if (isUnwantedButtonOrLink(el)) return false;
      const id = (el.id || "").toLowerCase();
      const name = (el.name || "").toLowerCase();
      const txt = (el.innerText || el.value || "").toLowerCase();
      const href = (el.getAttribute("href") || "").toLowerCase();
      const aria = (el.getAttribute("aria-label") || "").toLowerCase();
      return id === targetLower || id.includes(targetLower) || name.includes(targetLower) || txt.includes(targetLower) || href.includes(targetLower) || aria.includes(targetLower);
    });
    if (matched) return matched;

    // 4. Fallback selector
    try {
      return document.querySelector(raw);
    } catch (e) {
      return null;
    }
  }

  function highlightPageElement(target, label) {
    const el = findTargetElement(target);
    if (!el) return false;

    el.scrollIntoView({ behavior: "smooth", block: "center" });

    const oldBadge = document.getElementById("nagarik-spotlight-badge");
    if (oldBadge) oldBadge.remove();

    const originalOutline = el.style.outline;
    const originalShadow = el.style.boxShadow;

    el.style.outline = "4px solid #F06A25";
    el.style.boxShadow = "0 0 32px #F06A25, 0 0 12px rgba(240, 106, 37, 0.85)";

    const badge = document.createElement("div");
    badge.id = "nagarik-spotlight-badge";
    const displayLabel = label || el.innerText?.trim() || "Click Here";
    badge.innerHTML = `<span>👉 Nagarik AI: ${displayLabel.length > 35 ? displayLabel.substring(0, 32) + '...' : displayLabel}</span>`;
    badge.style.position = "absolute";
    badge.style.background = "#F06A25";
    badge.style.color = "#0B0C1E";
    badge.style.padding = "6px 14px";
    badge.style.borderRadius = "20px";
    badge.style.fontWeight = "800";
    badge.style.fontSize = "13px";
    badge.style.zIndex = "999999999";
    badge.style.boxShadow = "0 6px 20px rgba(0,0,0,0.5)";
    badge.style.pointerEvents = "none";
    document.body.appendChild(badge);

    const rect = el.getBoundingClientRect();
    badge.style.top = Math.max(10, (window.scrollY + rect.top - 36)) + "px";
    badge.style.left = Math.max(10, (window.scrollX + rect.left)) + "px";

    setTimeout(() => {
      el.style.outline = originalOutline;
      el.style.boxShadow = originalShadow;
      if (badge) badge.remove();
    }, 12000);

    return true;
  }

  /**
   * Universal fuzzy DOM auto-filling across all inputs, textareas, selects
   * Handles multilingual tokens (English, Hindi, Telugu), word-overlap matching, and Aadhaar shielding.
   */
  function executeUniversalFill(fieldsData) {
    if (!fieldsData || typeof fieldsData !== "object") {
      return { success: false, filledCount: 0, filledItems: [] };
    }

    showBanner("Nagarik AI: Scanning and Populating Form Fields...");

    const allInputs = querySelectorAllDeep("input:not([type='hidden']), select, textarea");
    let filledCount = 0;
    const filledKeys = [];
    const filledItems = [];
    const filledInThisRun = new Set();

    // Reset any previous run markers so fields can be cleanly re-populated
    allInputs.forEach(el => {
      try {
        delete el.dataset.nagarikFilled;
      } catch (e) {}
    });

    // Helper to test if element matches keyword pattern
    function matchesKeywords(el, keywords) {
      if (!el) return false;
      const name = (el.name || "").toLowerCase();
      const id = (el.id || "").toLowerCase();
      const ph = (el.placeholder || el.getAttribute("data-placeholder") || el.getAttribute("aria-placeholder") || "").toLowerCase();
      const aria = (el.getAttribute("aria-label") || "").toLowerCase();
      const title = (el.title || "").toLowerCase();
      const formControlName = (el.getAttribute("formcontrolname") || el.getAttribute("ng-reflect-name") || "").toLowerCase();
      const autocomplete = (el.getAttribute("autocomplete") || "").toLowerCase();

      let labelText = "";
      if (el.id) {
        const lbl = document.querySelector(`label[for='${el.id}']`);
        if (lbl) labelText = (lbl.innerText || "").toLowerCase();
      }
      if (!labelText) {
        const parentLbl = el.closest("label");
        if (parentLbl) labelText = (parentLbl.innerText || "").toLowerCase();
      }
      if (!labelText && el.parentElement) {
        labelText = (el.parentElement.innerText || "").toLowerCase();
        if (el.parentElement.parentElement) {
          labelText += " " + (el.parentElement.parentElement.innerText || "").toLowerCase();
        }
      }
      const combined = `${name} ${id} ${ph} ${aria} ${title} ${formControlName} ${autocomplete} ${labelText.substring(0, 300)}`;
      return keywords.some(k => combined.includes(k.toLowerCase()));
    }

    // NOTE: OTP radio auto-selection strictly removed for citizen security and choice.

    // Explicit Mappings with Multilingual Tokens (EN, HI, TE) and Tag Preferences
    const mappings = [
      {
        fieldKeys: ["uid", "aadhaar", "aadhar", "aadhaar_number", "aadhar_number", "id_number", "identity_no"],
        domKeywords: ["uid", "aadhaar", "aadhar", "adharnumber", "aadhaarno", "aadharno", "uidai", "id_number", "identity_no", "identity", "enter aadhaar", "enter aadhaar number", "आधार", "ఆధార్"],
        negativeKeywords: ["father", "spouse", "nominee", "officer", "bank"],
        isIdentity: true,
        preferTag: "INPUT"
      },
      {
        fieldKeys: ["citizen_name", "name", "fullname", "applicant_name", "first_name", "applicant"],
        domKeywords: ["citizen-name", "citizen_name", "applicant_name", "candidate_name", "name", "fullname", "first_name", "fname", "txtname", "नाम", "పేరు"],
        negativeKeywords: ["father", "mother", "spouse", "husband", "nominee", "officer", "bank", "witness", "guardian", "department", "user_id", "login"],
        preferTag: "INPUT"
      },
      {
        fieldKeys: ["citizen_phone", "phone", "mobile", "contact_number", "contact"],
        domKeywords: ["citizen-phone", "citizen_phone", "mobile", "phone", "contact", "cell", "tel", "contact_no", "मोबाइल", "ఫోన్"],
        negativeKeywords: ["landline_std", "fax", "officer"],
        preferTag: "INPUT"
      },
      {
        fieldKeys: ["citizen_email", "email"],
        domKeywords: ["email", "mail", "e-mail", "email_id", "ईमेल", "ఈమెయిల్"],
        negativeKeywords: ["officer_email", "admin"],
        preferTag: "INPUT"
      },
      {
        fieldKeys: ["department", "dept", "ministry", "authority", "board"],
        domKeywords: ["department-select", "department", "dept", "ministry", "authority", "board", "विभाग", "విభాగం"],
        isDepartment: true,
        preferTag: "SELECT"
      },
      {
        fieldKeys: ["category", "issue", "sub_category", "subject", "topic"],
        domKeywords: ["category-select", "category", "issue category", "sub_category", "topic", "subject", "वर्गीकरण", "వర్గం"],
        isCategory: true,
        preferTag: "INPUT"
      },
      {
        fieldKeys: ["urgency_level", "urgency", "priority", "severity"],
        domKeywords: ["urgency-select", "urgency", "urgency_level", "priority", "severity", "तात्कालिकता", "తీవ్రత"],
        isUrgency: true,
        preferTag: "SELECT"
      },
      {
        fieldKeys: ["location", "address", "city", "ward", "landmark", "street", "district"],
        domKeywords: ["location-input", "location", "address", "ward", "landmark", "street", "city", "village", "district", "locality", "colony", "पता", "स्थान", "చిరునామా", "ప్రాంతం"],
        negativeKeywords: ["email", "ip_address", "mac_address", "web_address", "url"],
        preferTag: "INPUT"
      },
      {
        fieldKeys: ["description", "grievance", "problem", "problem_raw", "details", "issue", "petition"],
        domKeywords: ["description-textarea", "description", "grievance", "complaint", "details", "problem", "petition", "remarks", "message", "comments", "query", "issue description", "issue details", "विवरण", "समस्या", "शिकायत", "సమస్య", "ఫిర్యాదు", "వివరాలు"],
        preferTag: "TEXTAREA"
      },
      {
        fieldKeys: ["application_no", "app_no", "reg_no", "registration_no", "application_number", "roll_no", "user_id", "username"],
        domKeywords: ["txtregno", "application no", "application_no", "applicationno", "regno", "registration no", "appno", "rollno", "user id", "userid", "username", "पंजीकरण", "రిజిస్ట్రేషన్"],
        negativeKeywords: ["password", "otp", "pin", "code"],
        preferTag: "INPUT"
      },
      {
        fieldKeys: ["pincode", "pin_code", "zip", "postal_code"],
        domKeywords: ["pincode", "pin_code", "postal_code", "zip", "पिनकोड", "పిన్‌కోడ్"],
        preferTag: "INPUT"
      }
    ];

    function isSecPinOrCaptcha(el) { return isSensitiveOrAuthControl(el); }

    function isSensitiveOrAuthControl(el) {
      if (!el) return false;
      const t = (el.type || "").toLowerCase();
      if (t === "password") return true;
      const combined = `${el.id} ${el.name} ${el.placeholder || ""} ${el.getAttribute("aria-label") || ""} ${el.title || ""} ${el.className || ""}`.toLowerCase();
      return combined.includes("captcha") || 
             combined.includes("secpin") || 
             combined.includes("securitypin") || 
             combined.includes("security_pin") || 
             combined.includes("security pin") || 
             combined.includes("txtsecpin") || 
             combined.includes("captchacode") ||
             combined.includes("otp") ||
             combined.includes("passcode") ||
             combined.includes("token") ||
             combined.includes("secret") ||
             combined.includes("fingerprint") ||
             combined.includes("biometric") ||
             combined.includes("password");
    }

    // Find and populate values using two-pass prioritization (preferTag -> general match)
    mappings.forEach(mapping => {
      let val = null;
      for (const fk of mapping.fieldKeys) {
        if (fieldsData[fk]) {
          val = fieldsData[fk];
          break;
        }
      }

      // If department is missing, infer from problem description!
      if (!val && mapping.isDepartment && (fieldsData.description || fieldsData.problem_raw || fieldsData.grievance)) {
        val = inferCivicDepartment(fieldsData.description || fieldsData.problem_raw || fieldsData.grievance);
      }

      // If category is missing, provide default
      if (!val && mapping.isCategory) {
        val = "Civic Infrastructure & Public Service Grievance";
      }

      // If urgency is missing, default to HIGH
      if (!val && mapping.isUrgency) {
        val = "HIGH";
      }

      if (!val) return;

      // Clean value if digits
      if (mapping.isIdentity && typeof val === "string") {
        val = val.replace(/\s+/g, "");
      }

      // Pass 1: Try preferred tag match (explicitly avoiding Captcha/SecPin)
      let matchedEl = null;
      if (mapping.preferTag) {
        matchedEl = allInputs.find(el => !filledInThisRun.has(el) && el.tagName === mapping.preferTag && matchesKeywords(el, mapping.domKeywords) && !isSecPinOrCaptcha(el));
      }
      // Pass 2: Any matching element (explicitly avoiding Captcha/SecPin)
      if (!matchedEl) {
        matchedEl = allInputs.find(el => !filledInThisRun.has(el) && matchesKeywords(el, mapping.domKeywords) && !isSecPinOrCaptcha(el));
      }

      // UIDAI / Aadhaar Portal Specialized Fallback:
      // If filling identity (Aadhaar) on UIDAI / login page and no match found yet:
      if (!matchedEl && mapping.isIdentity && (/uidai/i.test(window.location.hostname) || /uidai/i.test(window.location.href) || /aadhaar|aadhar/i.test(document.title) || /aadhaar/i.test(document.body ? document.body.innerText.substring(0, 500) : ""))) {
        matchedEl = allInputs.find(el => !filledInThisRun.has(el) && !isSensitiveOrAuthControl(el) && el.tagName === "INPUT" && (el.type === "text" || el.type === "tel" || el.type === "number" || !el.type));
      }

      if (matchedEl) {
        const el = matchedEl;
        filledInThisRun.add(el);
        if (el.tagName === "SELECT") {
          const valStr = String(val).toLowerCase();
          // 1. Direct substring search
          let option = Array.from(el.options).find(o => {
            if (!o.value) return false;
            const optLower = (o.text + " " + o.value).toLowerCase();
            return optLower.includes(valStr) || valStr.includes(optLower);
          });

          // 2. Word-overlap search (if department or category)
          if (!option) {
            const words = valStr.split(/[\s\-_&,]+/).filter(w => w.length >= 4);
            option = Array.from(el.options).find(o => {
              if (!o.value) return false;
              const optLower = (o.text + " " + o.value).toLowerCase();
              return words.some(w => optLower.includes(w));
            });
          }

          // 3. Fallback for urgency
          if (!option && mapping.isUrgency) {
            option = Array.from(el.options).find(o => (o.value || "").toUpperCase() === "HIGH" || o.text.toUpperCase().includes("HIGH"));
          }

          if (option) {
            el.value = option.value;
            el.dispatchEvent(new Event("change", { bubbles: true, composed: true }));
            el.dataset.nagarikFilled = "true";
            el.classList.add("jansetu-highlight");
            filledCount++;
            filledKeys.push(mapping.fieldKeys[0]);
            filledItems.push({
              key: mapping.fieldKeys[0],
              label: el.placeholder || el.name || el.id || mapping.fieldKeys[0],
              maskedValue: option.text || option.value
            });
          }
        } else {
          setNativeValue(el, val);
          el.dataset.nagarikFilled = "true";
          filledCount++;
          filledKeys.push(mapping.fieldKeys[0]);
          filledItems.push({
            key: mapping.fieldKeys[0],
            label: el.placeholder || el.name || el.id || mapping.fieldKeys[0],
            maskedValue: mapping.isIdentity && String(val).length >= 8 ? "XXXXXXXX" + String(val).slice(-4) : String(val)
          });
        }
      }
    });

    // Auto-check declaration / agreement checkboxes
    const agreementCheckboxes = allInputs.filter(el => 
      el.type === "checkbox" && 
      !el.checked && 
      matchesKeywords(el, ["agree", "declaration", "terms", "declare", "certify", "accept", "consent", "confirm"])
    );
    if (agreementCheckboxes.length > 0) {
      setTimeout(() => {
        highlightPageElement(agreementCheckboxes[0], "Citizen Action: Review & Accept Declaration");
      }, 700);
    }

    // Also handle any arbitrary keys passed directly in fieldsData
    for (const [key, rawVal] of Object.entries(fieldsData)) {
      if (filledKeys.includes(key) || !rawVal) continue;
      let val = rawVal;

      for (const el of allInputs) {
        if (filledInThisRun.has(el)) continue;
        if (isSensitiveOrAuthControl(el)) continue; // STRICTLY PREVENT FILLING CAPTCHA / SECURITY PIN
        if (matchesKeywords(el, [key])) {
          setNativeValue(el, val);
          filledInThisRun.add(el);
          el.dataset.nagarikFilled = "true";
          filledCount++;
          filledItems.push({
            key: key,
            label: el.placeholder || el.name || el.id || key,
            maskedValue: typeof val === "string" && val.length === 12 && /^\d+$/.test(val) ? "XXXXXXXX" + val.slice(8) : String(val)
          });
          break;
        }
      }
    }

    // Check if Captcha is present on the page and spotlight it
    let hasCaptcha = false;
    const captchaEl = allInputs.find(el => matchesKeywords(el, ["captcha", "security code", "security_code", "captchacode"]));
    if (captchaEl) {
      hasCaptcha = true;
      setTimeout(() => {
        highlightPageElement(captchaEl, "Enter Security Captcha");
      }, 500);
    }

    // Visual floating banner on the page
    showBanner(`Nagarik AI: Form Populated (${filledCount} Fields) & Aadhaar Shielded!`, true, filledCount);

    return {
      success: filledCount > 0,
      filledCount,
      filledKeys,
      filledItems,
      hasCaptcha,
      notice: `Nagarik AI: Populated ${filledCount} field${filledCount === 1 ? '' : 's'}.`
    };
  }

  function safeRuntimeSendMessage(msg) {
    try {
      chrome.runtime.sendMessage(msg, () => {
        if (chrome.runtime.lastError) {
          const _ = chrome.runtime.lastError.message;
        }
      });
    } catch (e) {}
  }

  // Observe DOM for newly rendered tracking ID safely
  if (typeof MutationObserver !== "undefined" && document.body) {
    let lastReportedId = null;
    const observer = new MutationObserver(() => {
      try {
        const bodyTxt = document.body ? document.body.innerText : "";
        if (/registered successfully|grievance lodged|registration no|receipt|complaint no/i.test(bodyTxt)) {
          const adapter = typeof window.getPortalAdapter === "function" ? window.getPortalAdapter() : null;
          if (adapter && typeof adapter.readTrackingId === "function") {
            adapter.readTrackingId().then(trackingId => {
              if (trackingId && trackingId !== lastReportedId) {
                lastReportedId = trackingId;
                safeRuntimeSendMessage({
                  action: "TRACKING_ID_DETECTED",
                  trackingId: trackingId
                });
              }
            }).catch(() => {});
          }
        }
      } catch (err) {}
    });

    observer.observe(document.body, { childList: true, subtree: true });
  }

  // Continuous DOM Mutation Observer:
  // Detects dynamic rendering and notifies sidepanel
  let mutationTimeout = null;
  if (typeof MutationObserver !== "undefined" && document.body) {
    const domObserver = new MutationObserver((mutations) => {
      let shouldNotify = false;
      for (const m of mutations) {
        if (m.addedNodes && m.addedNodes.length > 0) {
          for (const node of m.addedNodes) {
            if (node.nodeType === Node.ELEMENT_NODE) {
              if (node.matches && (node.matches("input, select, textarea, form") || node.querySelector("input, select, textarea, form"))) {
                shouldNotify = true;
                break;
              }
            }
          }
        }
        if (shouldNotify) break;
      }

      if (shouldNotify) {
        clearTimeout(mutationTimeout);
        mutationTimeout = setTimeout(() => {
          safeRuntimeSendMessage({ action: "PAGE_DOM_MUTATED" });
        }, 500);
      }
    });

    domObserver.observe(document.body, { childList: true, subtree: true });
  }

  // Listen for extension messages
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    // 1. CHECK_PAGE_SUPPORT: ALWAYS return supported: true and extract real DOM info
    if (message.action === "CHECK_PAGE_SUPPORT") {
      const domInfo = extractPageDomInfo();
      const adapter = typeof window.getPortalAdapter === "function" ? window.getPortalAdapter() : null;
      sendResponse({
        supported: true,
        portalName: adapter ? adapter.name : domInfo.domain,
        url: window.location.href,
        ...domInfo
      });
      return true;
    }

    // 2. INSPECT_PAGE_FORM: ALWAYS return supported: true and full DOM inspection
    if (message.action === "INSPECT_PAGE_FORM") {
      const domInfo = extractPageDomInfo();
      const adapter = typeof window.getPortalAdapter === "function" ? window.getPortalAdapter() : null;
      if (adapter && typeof adapter.inspect === "function") {
        adapter.inspect().then(inspection => {
          sendResponse({
            supported: true,
            portalName: adapter.name,
            ...inspection,
            ...domInfo
          });
        }).catch(() => {
          sendResponse({
            supported: true,
            portalName: domInfo.domain,
            ...domInfo
          });
        });
        return true;
      }
      sendResponse({
        supported: true,
        portalName: domInfo.domain,
        ...domInfo
      });
      return true;
    }

    // 3. FILL_FIELDS: Universal fuzzy DOM auto-filling across all inputs/textareas/selects
    if (message.action === "FILL_FIELDS") {
      const res = executeUniversalFill(message.fields);
      sendResponse(res);
      return true;
    }

    // 4. FILL_PORTAL_FORM
    if (message.action === "FILL_PORTAL_FORM") {
      const res = executeUniversalFill(message.formData);
      sendResponse(res);
      return true;
    }

    // 5. HIGHLIGHT_PAGE_ELEMENT
    if (message.action === "HIGHLIGHT_PAGE_ELEMENT") {
      const ok = highlightPageElement(message.target || "SUBMIT", message.label);
      sendResponse({ success: ok });
      return true;
    }
  function isSubmissionOrAuthElement(el) {
    if (!el) return false;

    // Direct and ancestor inspection (prevents child icon/span event delegation bypass)
    const candidate = (el.closest && el.closest("button, [role='button'], input[type='submit'], input[type='image'], a, form")) || el;

    const tagName = (candidate.tagName || el.tagName || "").toUpperCase();
    const type = (candidate.type || candidate.getAttribute("type") || el.type || "").toLowerCase();
    const role = (candidate.getAttribute("role") || el.getAttribute("role") || "").toLowerCase();

    // 1. Explicit HTML submit/payment types
    if (type === "submit" || type === "image") return true;

    // 2. Buttons in a form without explicit type='button' default to submit per HTML5 spec
    if (tagName === "BUTTON" && type !== "button" && candidate.form) return true;
    if (tagName === "FORM") return true;

    // 3. Inspect text, title, ARIA, ID, and action attributes
    const text = `${candidate.innerText || candidate.value || ""} ${el.innerText || el.value || ""}`.toLowerCase().trim();
    const aria = `${candidate.getAttribute("aria-label") || ""} ${el.getAttribute("aria-label") || ""}`.toLowerCase();
    const title = `${candidate.title || ""} ${el.title || ""}`.toLowerCase();
    const name = `${candidate.name || ""} ${el.name || ""}`.toLowerCase();
    const id = `${candidate.id || ""} ${el.id || ""}`.toLowerCase();
    const formAction = (candidate.getAttribute("formaction") || "").toLowerCase();
    const dataAction = `${candidate.getAttribute("data-action") || ""} ${candidate.getAttribute("data-target") || ""}`.toLowerCase();
    const onclick = (candidate.getAttribute("onclick") || el.getAttribute("onclick") || "").toLowerCase();

    const combined = `${text} ${aria} ${title} ${name} ${id} ${formAction} ${dataAction} ${onclick}`;
    const submissionKeywords = [
      "submit", "login", "log in", "sign in", "apply", "lodge", "pay", "payment",
      "register", "confirm", "send otp", "get otp", "final", "proceed to pay",
      "lodge grievance", "file complaint", "submit petition", "verify & submit",
      "proceed", "continue", "next step", "checkout", "authenticate"
    ];

    if (submissionKeywords.some(kw => combined.includes(kw))) return true;

    // 4. Any element with programmatic form submission triggers
    if (onclick.includes(".submit(") || onclick.includes("submitform") || onclick.includes("dosubmit") || onclick.includes("postform")) {
      return true;
    }

    return false;
  }



    // 6. CLICK_PAGE_ELEMENT
    if (message.action === "CLICK_PAGE_ELEMENT") {
      const el = findTargetElement(message.target);
      if (!el) {
        sendResponse({ success: false, error: "Element not found" });
        return true;
      }

      // DOM-ACTION LAYER SUBMISSION GUARD:
      // Inspect resolved DOM element directly (type, form relation, ARIA, and action semantics).
      // Blocks opaque button IDs (e.g. #btn_8271) as well as named targets.
      const targetStr = String(message.target || "").toUpperCase();
      if (/SUBMIT|LOGIN|APPLY|LODGE|PAY|REGISTER|CONFIRM|SEND_OTP|FINAL/i.test(targetStr) || isSubmissionOrAuthElement(el)) {
        highlightPageElement(el, "Citizen Action Required: Click to Submit");
        sendResponse({ 
          success: false, 
          blocked: true, 
          reason: "Nagarik AI Safety Guard: Final form submission, login, and payment actions must be initiated by the citizen at the DOM layer." 
        });
        return true;
      }

      el.click();
      sendResponse({ success: true });
      return true;
    }

    // 7. AUTOFILL_FROM_DOC
    if (message.action === "AUTOFILL_FROM_DOC") {
      const res = executeUniversalFill(message.fields);
      sendResponse(res);
      return true;
    }

    // 8. FILL_SINGLE_FIELD
    if (message.action === "FILL_SINGLE_FIELD") {
      const singleObj = {};
      singleObj[message.key] = message.value;
      const res = executeUniversalFill(singleObj);
      sendResponse(res);
      return true;
    }

    // 9. GUIDE_LOGIN_SEQUENCE (Sequential Order: Aadhaar / Appl No -> Password -> Security PIN / Captcha -> Log In)
    if (message.action === "GUIDE_LOGIN_SEQUENCE") {
      const allInputs = querySelectorAllDeep("input:not([type='hidden']), select, textarea");
      
      const appNoEl = allInputs.find(el => {
        if (isSecPinOrCaptcha(el)) return false;
        const s = `${el.id} ${el.name} ${el.placeholder || ""} ${el.getAttribute("aria-label") || ""} ${el.parentElement ? el.parentElement.innerText : ""}`.toLowerCase();
        return s.includes("aadhaar") || s.includes("aadhar") || s.includes("uid") ||
               s.includes("regno") || s.includes("application_no") || s.includes("applicationno") ||
               s.includes("appno") || s.includes("userid") || s.includes("user_id") ||
               s.includes("username") || s.includes("txtregno") || s.includes("rollno") ||
               s.includes("आधार") || s.includes("ఆధార్");
      });

      const pwdEl = allInputs.find(el => {
        if (isSecPinOrCaptcha(el)) return false;
        const s = `${el.id} ${el.name} ${el.placeholder || ""}`.toLowerCase();
        return el.type === "password" || s.includes("password") || s.includes("txtpassword") || s.includes("passwd");
      });

      const captchaEl = allInputs.find(el => isSecPinOrCaptcha(el));
      const loginBtn = findTargetElement("LOGIN");

      const isAadhaar = appNoEl && /aadhaar|aadhar|uid/i.test(`${appNoEl.id} ${appNoEl.name} ${appNoEl.placeholder} ${appNoEl.parentElement ? appNoEl.parentElement.innerText : ""}`);

      if (appNoEl && !(appNoEl.value || '').trim()) {
        const step1Label = isAadhaar ? "👉 Step 1: Enter Aadhaar Number" : "👉 Step 1: Enter Application No";
        highlightPageElement(appNoEl, step1Label);
        try { appNoEl.focus(); } catch (e) {}
        showBanner(step1Label, false);
        sendResponse({ success: true, step: 1, target: isAadhaar ? "Aadhaar Number" : "Application No" });
        return true;
      }

      if (pwdEl && !(pwdEl.value || '').trim()) {
        highlightPageElement(pwdEl, "👉 Step 2: Enter Password");
        try { pwdEl.focus(); } catch (e) {}
        showBanner("👉 Step 2: Enter Password", false);
        sendResponse({ success: true, step: 2, target: "Password" });
        return true;
      }

      if (captchaEl && !(captchaEl.value || '').trim()) {
        highlightPageElement(captchaEl, "👉 Step 3: Enter Captcha / Security PIN");
        try { captchaEl.focus(); } catch (e) {}
        showBanner("👉 Step 3: Enter Captcha shown in image (Manual input)", false);
        sendResponse({ success: true, step: 3, target: "Captcha / Security PIN" });
        return true;
      }

      if (loginBtn) {
        highlightPageElement(loginBtn, isAadhaar ? "👉 Final Step: Click Login With OTP" : "👉 Final Step: Click Log In");
        showBanner(isAadhaar ? "👉 Click Login With OTP to Proceed" : "👉 Click Log In to Proceed", true);
        sendResponse({ success: true, step: 4, target: "Log In Button" });
        return true;
      }

      sendResponse({ success: false, reason: "No standard login fields found" });
      return true;
    }
  });
})();
