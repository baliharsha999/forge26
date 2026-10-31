/**
 * JanSetu Lite Content Script
 * Injected into supported municipal and civic portals.
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
          <span style="font-size: 9px; color: #8F93B5; font-weight: normal; text-transform: uppercase; letter-spacing: 0.5px;">Auto-Filling Portal</span>
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

  function findTargetElement(target) {
    if (!target) return null;
    const raw = String(target).trim();
    const targetUpper = raw.toUpperCase();
    const targetLower = raw.toLowerCase();

    // 1. First attempt exact CSS selector if formatted like one
    if (raw.startsWith(".") || raw.startsWith("#") || raw.startsWith("[") || (raw.includes("[") && raw.includes("]"))) {
      try {
        const found = document.querySelector(raw);
        if (found) return found;
      } catch (e) {}
    }

    const allInteractive = Array.from(document.querySelectorAll("a, button, input[type='submit'], input[type='button'], [role='button'], h3 a, h4 a, li a, .btn, .button"));

    // 2. Specific intent mappings
    if (targetUpper === "SIGN_IN" || targetUpper === "LOGIN" || targetUpper === "HIGHLIGHT_SIGNIN") {
      const found = allInteractive.find(el => {
        const txt = (el.innerText || el.value || "").toLowerCase();
        const href = (el.getAttribute("href") || "").toLowerCase();
        const cls = (el.className || "").toLowerCase();
        return (txt.includes("sign in") || txt.includes("signin") || txt.includes("login") || href.includes("signin") || href.includes("login") || cls.includes("signin")) && !txt.includes("officer");
      });
      if (found) return found;
    }

    if (targetUpper === "REGISTER" || targetUpper === "SIGN_UP" || targetUpper === "HIGHLIGHT_REGISTER") {
      const found = allInteractive.find(el => {
        const txt = (el.innerText || el.value || "").toLowerCase();
        const href = (el.getAttribute("href") || "").toLowerCase();
        return txt.includes("register") || txt.includes("sign up") || txt.includes("signup") || href.includes("registration") || txt.includes("candidate");
      });
      if (found) return found;
    }

    if (targetUpper === "LODGE" || targetUpper === "GRIEVANCE") {
      const found = allInteractive.find(el => {
        const txt = (el.innerText || el.value || "").toLowerCase();
        const href = (el.getAttribute("href") || "").toLowerCase();
        return txt.includes("lodge") || txt.includes("grievance") || href.includes("lodge");
      });
      if (found) return found;
    }

    // 3. Substring match across all interactive elements
    const matched = allInteractive.find(el => {
      const txt = (el.innerText || el.value || "").toLowerCase();
      const href = (el.getAttribute("href") || "").toLowerCase();
      const aria = (el.getAttribute("aria-label") || "").toLowerCase();
      const title = (el.getAttribute("title") || "").toLowerCase();
      return txt.includes(targetLower) || href.includes(targetLower) || aria.includes(targetLower) || title.includes(targetLower);
    });
    if (matched) return matched;

    // 4. Token match (any significant word >= 4 letters)
    const tokens = targetLower.split(/\s+/).filter(t => t.length >= 4 && !["step", "click", "find", "open", "here", "look"].includes(t));
    if (tokens.length > 0) {
      const tokenMatch = allInteractive.find(el => {
        const txt = (el.innerText || el.value || "").toLowerCase();
        const href = (el.getAttribute("href") || "").toLowerCase();
        return tokens.some(t => txt.includes(t) || href.includes(t));
      });
      if (tokenMatch) return tokenMatch;
    }

    // 5. Try standard querySelector as fallback
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

  // Observe DOM for newly rendered tracking ID safely (only when submit happens)
  if (typeof MutationObserver !== "undefined" && document.body) {
    let lastReportedId = null;
    const observer = new MutationObserver(() => {
      try {
        const bodyTxt = document.body ? document.body.innerText : "";
        // Only inspect if page contains post-submission success indicators
        if (/registered successfully|grievance lodged|registration no|receipt/i.test(bodyTxt)) {
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
      } catch (err) {
        // Silent catch to prevent console errors
      }
    });

    observer.observe(document.body, { childList: true, subtree: true });
  }

  // ----------------------------------------------------------------
  // Document-to-Form Intelligent Auto-Filler
  // ----------------------------------------------------------------
  function autoFillFromDocumentFields(fields) {
    if (!fields || typeof fields !== "object") return { success: false, filledCount: 0 };
    
    let filledCount = 0;
    const allInputs = Array.from(document.querySelectorAll("input, select, textarea"));

    function matchAndFill(patternKeys, value) {
      if (!value) return false;
      const valStr = String(value).trim();
      let didFill = false;

      for (const el of allInputs) {
        if (el.dataset.nagarikFilled) continue;
        const name = (el.name || "").toLowerCase();
        const id = (el.id || "").toLowerCase();
        const placeholder = (el.placeholder || "").toLowerCase();
        const aria = (el.getAttribute("aria-label") || "").toLowerCase();

        // Check if element label or nearby text matches
        let labelText = "";
        if (el.id) {
          const lbl = document.querySelector(`label[for='${el.id}']`);
          if (lbl) labelText = (lbl.innerText || "").toLowerCase();
        }

        const combined = `${name} ${id} ${placeholder} ${aria} ${labelText}`;

        const isMatch = patternKeys.some(k => combined.includes(k.toLowerCase()));
        if (isMatch) {
          if (el.tagName === "SELECT") {
            // Select dropdown option
            const opts = Array.from(el.options);
            const foundOpt = opts.find(o => 
              o.text.toLowerCase().includes(valStr.toLowerCase()) || 
              o.value.toLowerCase().includes(valStr.toLowerCase())
            );
            if (foundOpt) {
              el.value = foundOpt.value;
              el.dispatchEvent(new Event("change", { bubbles: true }));
              didFill = true;
            }
          } else if (el.type === "radio") {
            const radVal = (el.value || "").toLowerCase();
            if (radVal === valStr.toLowerCase() || (valStr.toLowerCase() === "male" && radVal.startsWith("m")) || (valStr.toLowerCase() === "female" && radVal.startsWith("f"))) {
              el.checked = true;
              el.dispatchEvent(new Event("change", { bubbles: true }));
              didFill = true;
            }
          } else {
            // Text, date, number inputs
            el.focus();
            el.value = valStr;
            el.dispatchEvent(new Event("input", { bubbles: true }));
            el.dispatchEvent(new Event("change", { bubbles: true }));
            el.dispatchEvent(new Event("blur", { bubbles: true }));
            didFill = true;
          }

          if (didFill) {
            el.dataset.nagarikFilled = "true";
            el.style.outline = "3px solid #10b981";
            el.style.boxShadow = "0 0 15px rgba(16, 185, 129, 0.5)";
            el.style.transition = "outline 0.3s, box-shadow 0.3s";
            setTimeout(() => {
              el.style.outline = "";
              el.style.boxShadow = "";
            }, 10000);
            filledCount++;
            break; // Fill one element per pattern group
          }
        }
      }
      return didFill;
    }

    // 1. Candidate Full Name
    matchAndFill(["candidate_name", "applicant_name", "citizen_name", "txtname", "fullname", "name"], fields.candidate_name || fields.full_name || fields.citizen_name);

    // 2. Father's Name
    matchAndFill(["father", "father_name", "guardian"], fields.father_name);

    // 3. Mother's Name
    matchAndFill(["mother", "mother_name"], fields.mother_name);

    // 4. Roll Number
    matchAndFill(["roll_no", "roll_number", "rollno", "marksheet_no", "hall_ticket", "matric_roll"], fields.roll_number || fields.roll_no);

    // 5. Gender
    matchAndFill(["gender", "sex"], fields.gender);

    // 6. Date of Birth
    const dob = fields.dob || fields.date_of_birth;
    if (dob) {
      // Try single DOB input
      const filledSingle = matchAndFill(["dob", "date_of_birth", "birth_date", "birthdate"], dob);
      if (!filledSingle && dob.includes("/")) {
        // Try split day, month, year dropdowns (common on NTA / CPGRAMS)
        const parts = dob.split("/");
        if (parts.length === 3) {
          matchAndFill(["dob_day", "birth_day", "day"], parts[0].replace(/^0+/, ''));
          matchAndFill(["dob_month", "birth_month", "month"], parts[1].replace(/^0+/, ''));
          matchAndFill(["dob_year", "birth_year", "year"], parts[2]);
        }
      }
    }

    // 7. Education Board
    matchAndFill(["board", "board_name", "education_board"], fields.board_name);

    // 8. Passing Year
    matchAndFill(["passing_year", "pass_year", "year_of_passing"], fields.passing_year);

    // 9. PIN Code
    matchAndFill(["pincode", "pin_code", "postal_code", "zip"], fields.pincode || fields.pin_code);

    // 10. Address / Location
    matchAndFill(["address", "permanent_address", "residential_address", "locality", "location"], fields.address || fields.location);

    showBanner(`⚡ Nagarik AI Auto-Filled ${filledCount} fields from your document!`, true);
    return { success: true, filledCount };
  }

  // ----------------------------------------------------------------
  // Real-Time Active Form Focus Observer (Live Copilot Assist)
  // ----------------------------------------------------------------
  let lastFocusedFieldKey = "";
  document.addEventListener("focusin", (e) => {
    const el = e.target;
    if (!el || !["INPUT", "SELECT", "TEXTAREA"].includes(el.tagName)) return;

    const name = (el.name || "").toLowerCase();
    const id = (el.id || "").toLowerCase();
    const ph = (el.placeholder || "").toLowerCase();
    let lbl = "";
    if (el.id) {
      const labelEl = document.querySelector(`label[for='${el.id}']`);
      if (labelEl) lbl = (labelEl.innerText || "").toLowerCase();
    }
    const combined = `${name} ${id} ${ph} ${lbl}`;

    let detectedKey = "";
    let label = "";

    if (combined.includes("roll")) {
      detectedKey = "roll_number";
      label = "10th Roll Number";
    } else if (combined.includes("apaar") || combined.includes("abc")) {
      detectedKey = "apaar_id";
      label = "APAAR / ABC ID";
    } else if (combined.includes("vid") || combined.includes("virtual")) {
      detectedKey = "aadhaar_vid";
      label = "Aadhaar Virtual ID (VID)";
    } else if (combined.includes("uan")) {
      detectedKey = "uan";
      label = "Universal Account Number (UAN)";
    } else if (combined.includes("application")) {
      detectedKey = "application_number";
      label = "Application Number";
    }

    if (detectedKey && detectedKey !== lastFocusedFieldKey) {
      lastFocusedFieldKey = detectedKey;
      chrome.runtime.sendMessage({
        action: "PAGE_FIELD_FOCUSED",
        fieldKey: detectedKey,
        label: label
      }).catch(() => {});
    }
  }, true);

  // Listen for extension messages
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === "AUTOFILL_FROM_DOC") {
      const res = autoFillFromDocumentFields(message.fields);
      sendResponse(res);
      return true;
    }

    if (message.action === "HIGHLIGHT_PAGE_ELEMENT") {
      const ok = highlightPageElement(message.target || "SIGN_IN", message.label);
      sendResponse({ success: ok });
      return true;
    }

    if (message.action === "CLICK_PAGE_ELEMENT") {
      const el = findTargetElement(message.target || "SIGN_IN");
      if (el) {
        el.click();
        sendResponse({ success: true });
      } else {
        sendResponse({ success: false, error: "Element not found" });
      }
      return true;
    }

    if (message.action === "CHECK_PAGE_SUPPORT") {
      const adapter = window.getPortalAdapter();
      sendResponse({
        supported: !!adapter,
        portalName: adapter ? adapter.name : null,
        url: window.location.href
      });
      return true;
    }

    if (message.action === "INSPECT_PAGE_FORM") {
      const adapter = window.getPortalAdapter();
      if (!adapter || typeof adapter.inspect !== "function") {
        sendResponse({
          supported: !!adapter,
          portalName: adapter ? adapter.name : null,
          fields: [],
          totalRequired: 0,
          filledRequired: 0
        });
        return true;
      }
      adapter.inspect().then(inspection => {
        sendResponse({
          supported: true,
          ...inspection
        });
      }).catch(err => {
        sendResponse({ supported: true, error: err.message, fields: [] });
      });
      return true;
    }

    if (message.action === "FILL_SINGLE_FIELD") {
      const adapter = window.getPortalAdapter();
      if (!adapter || typeof adapter.fillSingleField !== "function") {
        sendResponse({ success: false, error: "Adapter does not support single field fill" });
        return true;
      }
      showBanner("Filling " + (message.label || message.key) + "...");
      adapter.fillSingleField(message.key, message.value).then(res => {
        showBanner("Populated " + (message.label || message.key), true);
        sendResponse(res);
      }).catch(err => {
        showBanner("Error filling field: " + err.message, true);
        sendResponse({ success: false, error: err.message });
      });
      return true;
    }

    if (message.action === "FILL_FIELDS") {
      const adapter = window.getPortalAdapter();
      if (!adapter || typeof adapter.fillFields !== "function") {
        sendResponse({ success: false, error: "Adapter does not support fillFields" });
        return true;
      }
      showBanner("JanSetu Copilot is filling fields on page...");
      adapter.fillFields(message.fields).then(res => {
        showBanner("Updated portal fields!", true);
        sendResponse(res);
      }).catch(err => {
        showBanner("Error filling fields: " + err.message, true);
        sendResponse({ success: false, error: err.message });
      });
      return true;
    }

    if (message.action === "FILL_PORTAL_FORM") {
      const adapter = window.getPortalAdapter();
      if (!adapter) {
        sendResponse({
          success: false,
          error: "UNSUPPORTED_SITE",
          message: "No portal adapter found for this URL."
        });
        return true;
      }

      showBanner("Filling form fields via " + adapter.name + "...");

      adapter.fill(message.formData, (stepMsg) => {
        showBanner(stepMsg);
      }).then(result => {
        if (result.success) {
          showBanner("Form filled successfully! Please verify and submit.", true);
        } else {
          showBanner("Layout changed. Guided handoff required.", true);
        }
        sendResponse(result);
      }).catch(err => {
        showBanner("Error filling form: " + err.message, true);
        sendResponse({ success: false, error: err.message });
      });

      return true; // Keep message channel open for async response
    }
  });
})();
