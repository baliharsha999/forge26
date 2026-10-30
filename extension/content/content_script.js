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
    target = (target || "").toUpperCase();
    const allLinks = Array.from(document.querySelectorAll("a, button, input[type='submit'], input[type='button']"));

    if (target === "SIGN_IN" || target === "LOGIN") {
      return allLinks.find(el => {
        const txt = (el.innerText || el.value || "").toLowerCase();
        const href = (el.getAttribute("href") || "").toLowerCase();
        return (txt.includes("sign in") || txt.includes("signin") || txt.includes("login") || href.includes("signin") || href.includes("login")) && !txt.includes("officer");
      });
    }

    if (target === "REGISTER" || target === "SIGN_UP") {
      return allLinks.find(el => {
        const txt = (el.innerText || el.value || "").toLowerCase();
        const href = (el.getAttribute("href") || "").toLowerCase();
        return txt.includes("register") || txt.includes("sign up") || txt.includes("signup") || href.includes("registration");
      });
    }

    if (target === "LODGE" || target === "GRIEVANCE") {
      return allLinks.find(el => {
        const txt = (el.innerText || el.value || "").toLowerCase();
        const href = (el.getAttribute("href") || "").toLowerCase();
        return txt.includes("lodge") || txt.includes("grievance") || href.includes("lodge");
      });
    }

    return document.querySelector(target);
  }

  function highlightPageElement(target) {
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
    badge.innerHTML = `<span>👉 Nagarik AI: Click Here to Sign In</span>`;
    badge.style.position = "absolute";
    badge.style.background = "#F06A25";
    badge.style.color = "#0B0C1E";
    badge.style.padding = "6px 14px";
    badge.style.borderRadius = "20px";
    badge.style.fontWeight = "800";
    badge.style.fontSize = "13px";
    badge.style.zIndex = "999999999";
    badge.style.boxShadow = "0 6px 20px rgba(0,0,0,0.5)";
    document.body.appendChild(badge);

    const rect = el.getBoundingClientRect();
    badge.style.top = (window.scrollY + rect.top - 36) + "px";
    badge.style.left = (window.scrollX + rect.left) + "px";

    setTimeout(() => {
      el.style.outline = originalOutline;
      el.style.boxShadow = originalShadow;
      if (badge) badge.remove();
    }, 12000);

    return true;
  }

    // Observe DOM for newly rendered tracking ID (e.g. after citizen submits)
  const observer = new MutationObserver(() => {
    const adapter = window.getPortalAdapter();
    if (adapter) {
      adapter.readTrackingId().then(trackingId => {
        if (trackingId) {
          chrome.runtime.sendMessage({
            action: "TRACKING_ID_DETECTED",
            trackingId: trackingId
          });
        }
      });
    }
  });

  observer.observe(document.body, { childList: true, subtree: true });

  // Listen for extension messages
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === "HIGHLIGHT_PAGE_ELEMENT") {
      const ok = highlightPageElement(message.target || "SIGN_IN");
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
