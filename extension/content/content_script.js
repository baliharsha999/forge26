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
        <div style="font-weight: 700; color: #f59e0b;">JanSetu Lite Civic Copilot</div>
        <div style="color: #cbd5e1; font-size: 11px;">${text}</div>
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
    if (message.action === "CHECK_PAGE_SUPPORT") {
      const adapter = window.getPortalAdapter();
      sendResponse({
        supported: !!adapter,
        portalName: adapter ? adapter.name : null,
        url: window.location.href
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
