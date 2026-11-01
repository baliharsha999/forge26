/**
 * Nagarik AI - Content Script
 * Injected into all web pages to provide Universal Civic Copilot capabilities.
 * Always supports any webpage on desktop with real-time DOM analysis and form autofill.
 */
(() => {
  let activeBanner = null;

  function showBanner(text, isDone = false) {
    if (!activeBanner) {
      activeBanner = document.createElement("div");
      activeBanner.id = "jansetu-form-filling-banner";
      document.body.appendChild(activeBanner);
    }
    activeBanner.innerHTML = `
      <div class="${isDone ? '' : 'jansetu-spinner'}"></div>
      <div>
        <div style="font-weight: 800; color: #F06A25; font-size: 13px; display: flex; align-items: center; gap: 6px;">
          <span>Nagarik AI</span>
          <span style="font-size: 9px; color: #8F93B5; font-weight: normal; text-transform: uppercase; letter-spacing: 0.5px;">Universal Civic Shield</span>
        </div>
        <div style="color: #E8E9F2; font-size: 11px;">${text}</div>
      </div>
    `;

    if (isDone) {
      setTimeout(() => {
        if (activeBanner) {
          activeBanner.style.opacity = "0";
          setTimeout(() => {
            if (activeBanner) activeBanner.remove();
            activeBanner = null;
          }, 400);
        }
      }, 5000);
    }
  }

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
    } else {
      element.value = value;
    }

    try {
      element.dispatchEvent(new Event("focus", { bubbles: true }));
      element.dispatchEvent(new Event("keydown", { bubbles: true, key: "Enter" }));
      element.dispatchEvent(new Event("input", { bubbles: true, composed: true }));
      element.dispatchEvent(new Event("keyup", { bubbles: true }));
      element.dispatchEvent(new Event("change", { bubbles: true, composed: true }));
      element.dispatchEvent(new Event("blur", { bubbles: true }));
    } catch (e) {}

    element.classList.add("jansetu-highlight");
    element.style.outline = "3px solid #F06A25";
    element.style.boxShadow = "0 0 16px rgba(240, 106, 37, 0.55)";

    try {
      const rect = element.getBoundingClientRect();
      const badge = document.createElement("div");
      badge.className = "nagarik-field-autofilled-tag";
      badge.innerText = "✓ Nagarik AI: Auto-Filled";
      badge.style.position = "absolute";
      badge.style.background = "#10B981";
      badge.style.color = "#0B0C1E";
      badge.style.padding = "2px 8px";
      badge.style.borderRadius = "10px";
      badge.style.fontSize = "10px";
      badge.style.fontWeight = "bold";
      badge.style.zIndex = "9999999";
      badge.style.pointerEvents = "none";
      badge.style.top = Math.max(0, (window.scrollY + rect.top - 18)) + "px";
      badge.style.left = Math.max(0, (window.scrollX + rect.left + 4)) + "px";
      document.body.appendChild(badge);
      setTimeout(() => { badge.remove(); }, 6000);
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

    // Discover form inputs, textareas, selects (using deep traversal across Shadow DOM)
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

    // Discover actionable buttons (including shadow DOM buttons)
    const actionButtons = querySelectorAllDeep("button, input[type='submit'], input[type='button'], a.btn, a.button, [role='button']")
      .filter(el => {
        const rect = el.getBoundingClientRect();
        return rect.width > 0 && rect.height > 0 && el.style.display !== "none" && el.style.visibility !== "hidden";
      })
      .slice(0, 12)
      .map(b => ({
        text: (b.innerText || b.value || b.getAttribute("aria-label") || "Action").replace(/\s+/g, " ").trim(),
        id: b.id || "",
        type: b.type || "button",
        selector: b.id ? `#${b.id}` : (b.name ? `[name='${b.name}']` : b.tagName.toLowerCase())
      }));

    return {
      title,
      url,
      domain,
      mainHeading,
      hasForm,
      fields,
      actionButtons,
      totalInputs: fields.length
    };
  }

  /**
   * Target Element Finder (by intent, selector, or text, with Shadow DOM support)
   */
  function findTargetElement(target) {
    if (!target) return null;
    const raw = String(target).trim();
    const targetUpper = raw.toUpperCase();
    const targetLower = raw.toLowerCase();

    // 1. Exact CSS selector (deep query)
    if (raw.startsWith(".") || raw.startsWith("#") || raw.startsWith("[") || (raw.includes("[") && raw.includes("]"))) {
      try {
        const found = querySelectorAllDeep(raw)[0];
        if (found) return found;
      } catch (e) {}
    }

    const allInteractive = querySelectorAllDeep("a, button, input[type='submit'], input[type='button'], [role='button'], .btn, .button");

    // 2. Specific intent mappings (supports UIDAI, CPGRAMS, state portals)
    if (targetUpper === "SUBMIT" || targetUpper === "SAVE" || targetUpper === "LODGE" || targetUpper === "APPLY" || targetUpper === "LOGIN" || targetUpper === "OTP") {
      const found = allInteractive.find(el => {
        const txt = (el.innerText || el.value || "").toLowerCase();
        const id = (el.id || "").toLowerCase();
        const name = (el.name || "").toLowerCase();
        return id === "login-btn" || id.includes("login") || id.includes("submit") || name.includes("login") ||
               txt.includes("login with otp") || txt.includes("send otp") || txt.includes("get otp") ||
               txt.includes("login") || txt.includes("submit") || txt.includes("lodge") ||
               txt.includes("apply") || txt.includes("save") || txt.includes("proceed") || txt.includes("register");
      });
      if (found) return found;
    }

    if (targetUpper === "SIGN_IN" || targetUpper === "LOGIN") {
      const found = allInteractive.find(el => {
        const txt = (el.innerText || el.value || "").toLowerCase();
        const href = (el.getAttribute("href") || "").toLowerCase();
        const id = (el.id || "").toLowerCase();
        return (id.includes("login") || txt.includes("sign in") || txt.includes("signin") || txt.includes("login") || href.includes("login")) && !txt.includes("officer");
      });
      if (found) return found;
    }

    // 3. Substring match
    const matched = allInteractive.find(el => {
      const txt = (el.innerText || el.value || "").toLowerCase();
      const href = (el.getAttribute("href") || "").toLowerCase();
      const aria = (el.getAttribute("aria-label") || "").toLowerCase();
      return txt.includes(targetLower) || href.includes(targetLower) || aria.includes(targetLower);
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
    el.style.boxShadow = "0 0 30px #F06A25, 0 0 10px rgba(240, 106, 37, 0.8)";

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
   * Supports Shadow DOM and portal-specific identity fields (UIDAI / CPGRAMS / State Portals)
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

    // Helper to test if element matches keyword pattern
    function matchesKeywords(el, keywords) {
      const name = (el.name || "").toLowerCase();
      const id = (el.id || "").toLowerCase();
      const ph = (el.placeholder || "").toLowerCase();
      const aria = (el.getAttribute("aria-label") || "").toLowerCase();
      const title = (el.title || "").toLowerCase();
      let labelText = "";
      if (el.id) {
        const lbl = document.querySelector(`label[for='${el.id}']`);
        if (lbl) labelText = (lbl.innerText || "").toLowerCase();
      }
      if (!labelText) {
        const parentLbl = el.closest("label");
        if (parentLbl) labelText = (parentLbl.innerText || "").toLowerCase();
      }
      const combined = `${name} ${id} ${ph} ${aria} ${title} ${labelText}`;
      return keywords.some(k => combined.includes(k.toLowerCase()));
    }

    // Auto-select "OTP Authentication" radio button if present on page (e.g. UIDAI)
    const otpRadio = allInputs.find(el => (el.type === "radio" || el.type === "checkbox") && matchesKeywords(el, ["otp authentication", "login with otp", "otp"]));
    if (otpRadio && !otpRadio.checked) {
      try {
        otpRadio.click();
        otpRadio.checked = true;
        otpRadio.dispatchEvent(new Event("change", { bubbles: true }));
      } catch (e) {}
    }

    // Process specific standard citizen fields
    const mappings = [
      {
        fieldKeys: ["uid", "aadhaar", "aadhar", "aadhaar_number", "aadhar_number", "id_number", "identity_no"],
        domKeywords: ["uid", "aadhaar", "aadhar", "adharnumber", "aadhaarno", "aadharno", "uidai", "id_number", "identity_no", "identity"],
        isIdentity: true
      },
      {
        fieldKeys: ["citizen_name", "name", "fullname", "applicant_name", "first_name", "applicant"],
        domKeywords: ["name", "citizen", "applicant", "fullname", "candidate", "user", "first_name", "fname"]
      },
      {
        fieldKeys: ["citizen_phone", "phone", "mobile", "contact_number", "contact"],
        domKeywords: ["mobile", "phone", "contact", "cell", "tel"]
      },
      {
        fieldKeys: ["citizen_email", "email"],
        domKeywords: ["email", "mail", "e-mail"]
      },
      {
        fieldKeys: ["location", "address", "city", "ward", "landmark", "street", "district"],
        domKeywords: ["location", "address", "ward", "landmark", "street", "city", "village", "district", "locality", "place"]
      },
      {
        fieldKeys: ["description", "grievance", "problem", "problem_raw", "details", "issue", "petition"],
        domKeywords: ["grievance", "complaint", "description", "details", "problem", "issue", "petition", "remarks", "message", "comments", "query"]
      },
      {
        fieldKeys: ["category", "department", "ministry", "service"],
        domKeywords: ["category", "department", "ministry", "service", "topic", "subject"]
      },
      {
        fieldKeys: ["pincode", "pin_code", "zip", "postal_code"],
        domKeywords: ["pincode", "pin_code", "postal_code", "zip", "pin"]
      },
      {
        fieldKeys: ["otp", "one_time_password", "passcode"],
        domKeywords: ["otp", "one time password", "passcode", "security token", "verification_code"]
      }
    ];

    // Find and populate values
    mappings.forEach(mapping => {
      let val = null;
      for (const fk of mapping.fieldKeys) {
        if (fieldsData[fk]) {
          val = fieldsData[fk];
          break;
        }
      }
      if (!val) return;

      // Clean value if digits
      if (mapping.isIdentity && typeof val === "string") {
        val = val.replace(/\s+/g, "");
      }

      for (const el of allInputs) {
        if (el.dataset.nagarikFilled) continue;
        if (matchesKeywords(el, mapping.domKeywords)) {
          if (el.tagName === "SELECT") {
            const valStr = String(val).toLowerCase();
            const option = Array.from(el.options).find(o => o.text.toLowerCase().includes(valStr) || o.value.toLowerCase().includes(valStr));
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
                maskedValue: mapping.isIdentity && String(val).length >= 8 ? "XXXXXXXX" + String(val).slice(-4) : String(val)
              });
              break;
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
            break;
          }
        }
      }
    });

    // Also handle any arbitrary keys passed directly in fieldsData
    for (const [key, rawVal] of Object.entries(fieldsData)) {
      if (filledKeys.includes(key) || !rawVal) continue;
      let val = rawVal;

      for (const el of allInputs) {
        if (el.dataset.nagarikFilled) continue;
        if (matchesKeywords(el, [key])) {
          setNativeValue(el, val);
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

    // Visual floating banner on the page as required
    showBanner(`Nagarik AI: Form Populated (${filledCount} Fields) & Aadhaar Shielded!`, true);

    return {
      success: filledCount > 0,
      filledCount,
      filledKeys,
      filledItems,
      hasCaptcha,
      notice: `Nagarik AI: Populated ${filledCount} field${filledCount === 1 ? '' : 's'}.`
    };
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
                chrome.runtime.sendMessage({
                  action: "TRACKING_ID_DETECTED",
                  trackingId: trackingId
                }).catch(() => {});
              }
            }).catch(() => {});
          }
        }
      } catch (err) {}
    });

    observer.observe(document.body, { childList: true, subtree: true });
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

    // 6. CLICK_PAGE_ELEMENT
    if (message.action === "CLICK_PAGE_ELEMENT") {
      const el = findTargetElement(message.target || "SUBMIT");
      if (el) {
        el.click();
        sendResponse({ success: true });
      } else {
        sendResponse({ success: false, error: "Element not found" });
      }
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
      const adapter = typeof window.getPortalAdapter === "function" ? window.getPortalAdapter() : null;
      if (adapter && typeof adapter.fillSingleField === "function") {
        adapter.fillSingleField(message.key, message.value).then(res => {
          sendResponse(res);
        }).catch(err => {
          sendResponse({ success: false, error: err.message });
        });
        return true;
      }
      const singleObj = {};
      singleObj[message.key] = message.value;
      const res = executeUniversalFill(singleObj);
      sendResponse(res);
      return true;
    }
  });
})();
