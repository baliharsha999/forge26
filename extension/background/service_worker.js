/**
 * Nagarik AI - Background Service Worker (Manifest V3)
 * "Empowering Every Citizen"
 * Acts as message router and active tab observer between Side Panel, Content Scripts, and Backend.
 */

// Open side panel on extension action click
chrome.sidePanel
  .setPanelBehavior({ openPanelOnActionClick: true })
  .catch((error) => console.error("Side panel config error:", error));

// Tab change & URL change listeners for Zero-Touch Auto-Inspection
chrome.tabs.onActivated.addListener((activeInfo) => {
  chrome.runtime.sendMessage({
    action: "ACTIVE_TAB_CHANGED",
    tabId: activeInfo.tabId
  }).catch(() => {
    // Side panel might not be open, silent catch
  });
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === "complete") {
    chrome.runtime.sendMessage({
      action: "ACTIVE_TAB_CHANGED",
      tabId: tabId,
      url: tab.url
    }).catch(() => {});
  }
});

// Message Router
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  // 0. Forward highlight/click requests to active tab's content script
  if (message.action === "TRIGGER_HIGHLIGHT_ELEMENT") {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (!tabs || tabs.length === 0) {
        sendResponse({ success: false, error: "NO_ACTIVE_TAB" });
        return;
      }
      chrome.tabs.sendMessage(tabs[0].id, {
        action: "HIGHLIGHT_PAGE_ELEMENT",
        target: message.target || "SIGN_IN"
      }, (res) => sendResponse(res || { success: true }));
    });
    return true;
  }

  if (message.action === "TRIGGER_CLICK_ELEMENT") {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (!tabs || tabs.length === 0) {
        sendResponse({ success: false, error: "NO_ACTIVE_TAB" });
        return;
      }
      chrome.tabs.sendMessage(tabs[0].id, {
        action: "CLICK_PAGE_ELEMENT",
        target: message.target || "SIGN_IN"
      }, (res) => sendResponse(res || { success: true }));
    });
    return true;
  }

  // 1. Relay detected tracking ID to side panel
  if (message.action === "TRACKING_ID_DETECTED") {
    chrome.runtime.sendMessage({
      action: "UPDATE_TRACKING_RECEIPT",
      trackingId: message.trackingId
    }).catch(() => {});
    return false;
  }

  // 2. Call FastAPI backend for Multimodal LLM analysis
  if (message.action === "CALL_BACKEND_ANALYZE") {
    fetch("http://localhost:8000/api/v1/grievance/analyze", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(message.payload)
    })
      .then(res => res.json())
      .then(data => sendResponse({ success: true, data: data }))
      .catch(err => sendResponse({ success: false, error: err.message }));
    return true; // Keep message channel open for async response
  }

  // 3. Forward form fill request to active tab's content script
  if (message.action === "TRIGGER_CONTENT_FILL") {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (!tabs || tabs.length === 0) {
        sendResponse({ success: false, error: "NO_ACTIVE_TAB" });
        return;
      }

      chrome.tabs.sendMessage(tabs[0].id, {
        action: "FILL_PORTAL_FORM",
        formData: message.formData
      }, (response) => {
        if (chrome.runtime.lastError) {
          sendResponse({
            success: false,
            error: "CONTENT_SCRIPT_NOT_READY",
            message: "Please open the municipal portal page (http://localhost:8000/portal) to file."
          });
        } else {
          sendResponse(response);
        }
      });
    });
    return true; // Keep channel open
  }

  // 4. Check active tab support
  if (message.action === "CHECK_ACTIVE_TAB_SUPPORT") {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (!tabs || tabs.length === 0) {
        sendResponse({ supported: false });
        return;
      }
      chrome.tabs.sendMessage(tabs[0].id, { action: "CHECK_PAGE_SUPPORT" }, (res) => {
        if (chrome.runtime.lastError) {
          sendResponse({ supported: false, url: tabs[0].url });
        } else {
          sendResponse(res);
        }
      });
    });
    return true;
  }

  // 5. Forward inspection request to active tab
  if (message.action === "TRIGGER_INSPECT_PAGE") {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (!tabs || tabs.length === 0) {
        sendResponse({ supported: false, error: "NO_ACTIVE_TAB" });
        return;
      }
      chrome.tabs.sendMessage(tabs[0].id, { action: "INSPECT_PAGE_FORM" }, (res) => {
        if (chrome.runtime.lastError) {
          sendResponse({ supported: false, error: "CONTENT_SCRIPT_NOT_READY", url: tabs[0].url });
        } else {
          sendResponse(res);
        }
      });
    });
    return true;
  }

  // 6. Forward single field fill request to active tab
  if (message.action === "TRIGGER_SINGLE_FIELD_FILL") {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (!tabs || tabs.length === 0) {
        sendResponse({ success: false, error: "NO_ACTIVE_TAB" });
        return;
      }
      chrome.tabs.sendMessage(tabs[0].id, {
        action: "FILL_SINGLE_FIELD",
        key: message.key,
        value: message.value,
        label: message.label
      }, (res) => {
        if (chrome.runtime.lastError) {
          sendResponse({ success: false, error: "CONTENT_SCRIPT_NOT_READY" });
        } else {
          sendResponse(res);
        }
      });
    });
    return true;
  }

  // 7. Forward batch field fill request to active tab
  if (message.action === "TRIGGER_FILL_FIELDS") {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (!tabs || tabs.length === 0) {
        sendResponse({ success: false, error: "NO_ACTIVE_TAB" });
        return;
      }
      chrome.tabs.sendMessage(tabs[0].id, {
        action: "FILL_FIELDS",
        fields: message.fields
      }, (res) => {
        if (chrome.runtime.lastError) {
          sendResponse({ success: false, error: "CONTENT_SCRIPT_NOT_READY" });
        } else {
          sendResponse(res);
        }
      });
    });
    return true;
  }
});
