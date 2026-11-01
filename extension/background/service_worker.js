/**
 * Nagarik AI - Background Service Worker (Manifest V3)
 * "Empowering Every Citizen"
 * Acts as message router and active tab observer between Side Panel, Content Scripts, and Backend.
 */

// Open side panel on extension action click
chrome.sidePanel
  .setPanelBehavior({ openPanelOnActionClick: true })
  .catch((error) => console.error("Side panel config error:", error));

// Helper: Ensure content script is injected into active tab if not already present
function ensureContentScriptInjected(tabId, callback) {
  if (!tabId || typeof chrome.scripting === "undefined") {
    if (callback) callback();
    return;
  }

  chrome.scripting.executeScript({
    target: { tabId: tabId },
    files: [
      "content/adapters/base_adapter.js",
      "content/adapters/mock_portal_adapter.js",
      "content/adapters/cpgrams_adapter.js",
      "content/adapters/generic_portal_adapter.js",
      "content/adapters/index.js",
      "content/content_script.js"
    ]
  }).then(() => {
    chrome.scripting.insertCSS({
      target: { tabId: tabId },
      files: ["content/banner.css"]
    }).catch(() => {});
    setTimeout(() => {
      if (callback) callback();
    }, 120);
  }).catch((err) => {
    // Some tabs like chrome:// cannot be injected
    if (callback) callback(err);
  });
}

// Tab change & URL change listeners for Zero-Touch Auto-Inspection
chrome.tabs.onActivated.addListener((activeInfo) => {
  chrome.runtime.sendMessage({
    action: "ACTIVE_TAB_CHANGED",
    tabId: activeInfo.tabId
  }).catch(() => {});
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
  // 1. Relay detected tracking ID to side panel
  if (message.action === "TRACKING_ID_DETECTED") {
    chrome.runtime.sendMessage({
      action: "UPDATE_TRACKING_RECEIPT",
      trackingId: message.trackingId
    }).catch(() => {});
    return false;
  }

  // 2. Relay dynamic DOM mutation to side panel
  if (message.action === "PAGE_DOM_MUTATED") {
    chrome.runtime.sendMessage({
      action: "PAGE_DOM_MUTATED"
    }).catch(() => {});
    return false;
  }

  // 3. Zero-Knowledge Local Processing Guarantee (Zero outbound network leakage)
  if (message.action === "CALL_BACKEND_ANALYZE") {
    sendResponse({ success: false, error: "Zero-Knowledge Local Mode Enforced" });
    return false;
  }

  // 4. Check active tab support (ALWAYS TRUE)
  if (message.action === "CHECK_ACTIVE_TAB_SUPPORT") {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (!tabs || tabs.length === 0) {
        sendResponse({ supported: true });
        return;
      }
      chrome.tabs.sendMessage(tabs[0].id, { action: "CHECK_PAGE_SUPPORT" }, (res) => {
        if (chrome.runtime.lastError) {
          ensureContentScriptInjected(tabs[0].id, () => {
            chrome.tabs.sendMessage(tabs[0].id, { action: "CHECK_PAGE_SUPPORT" }, (retryRes) => {
              sendResponse(retryRes || { supported: true, url: tabs[0].url });
            });
          });
        } else {
          sendResponse(res || { supported: true, url: tabs[0].url });
        }
      });
    });
    return true;
  }

  // 5. Forward inspection request to active tab
  if (message.action === "TRIGGER_INSPECT_PAGE") {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (!tabs || tabs.length === 0) {
        sendResponse({ supported: true, hasForm: false, fields: [] });
        return;
      }
      chrome.tabs.sendMessage(tabs[0].id, { action: "INSPECT_PAGE_FORM" }, (res) => {
        if (chrome.runtime.lastError) {
          ensureContentScriptInjected(tabs[0].id, () => {
            chrome.tabs.sendMessage(tabs[0].id, { action: "INSPECT_PAGE_FORM" }, (retryRes) => {
              sendResponse(retryRes || { supported: true, url: tabs[0].url, hasForm: false, fields: [] });
            });
          });
        } else {
          sendResponse(res || { supported: true, url: tabs[0].url, hasForm: false, fields: [] });
        }
      });
    });
    return true;
  }

  // 6. Forward batch field fill request to active tab
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
          ensureContentScriptInjected(tabs[0].id, () => {
            chrome.tabs.sendMessage(tabs[0].id, {
              action: "FILL_FIELDS",
              fields: message.fields
            }, (retryRes) => {
              sendResponse(retryRes || { success: true });
            });
          });
        } else {
          sendResponse(res || { success: true });
        }
      });
    });
    return true;
  }

  // 7. Forward highlight request to active tab
  if (message.action === "TRIGGER_HIGHLIGHT_ELEMENT") {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (!tabs || tabs.length === 0) {
        sendResponse({ success: false, error: "NO_ACTIVE_TAB" });
        return;
      }
      chrome.tabs.sendMessage(tabs[0].id, {
        action: "HIGHLIGHT_PAGE_ELEMENT",
        target: message.target || "SUBMIT",
        label: message.label
      }, (res) => {
        if (chrome.runtime.lastError) {
          ensureContentScriptInjected(tabs[0].id, () => {
            chrome.tabs.sendMessage(tabs[0].id, {
              action: "HIGHLIGHT_PAGE_ELEMENT",
              target: message.target || "SUBMIT",
              label: message.label
            }, (retryRes) => {
              sendResponse(retryRes || { success: true });
            });
          });
        } else {
          sendResponse(res || { success: true });
        }
      });
    });
    return true;
  }

  // 8. Forward click request to active tab
  if (message.action === "TRIGGER_CLICK_ELEMENT") {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (!tabs || tabs.length === 0) {
        sendResponse({ success: false, error: "NO_ACTIVE_TAB" });
        return;
      }
      chrome.tabs.sendMessage(tabs[0].id, {
        action: "CLICK_PAGE_ELEMENT",
        target: message.target || "SUBMIT"
      }, (res) => {
        sendResponse(res || { success: true });
      });
    });
    return true;
  }
});
