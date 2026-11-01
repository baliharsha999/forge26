/**
 * Nagarik AI - Background Service Worker (Manifest V3)
 * "Empowering Every Citizen"
 * Acts as message router and active tab observer between Side Panel, Content Scripts, and Backend.
 */

// Open side panel on extension action click
if (chrome.sidePanel && typeof chrome.sidePanel.setPanelBehavior === "function") {
  try {
    chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch(() => {});
  } catch (e) {}
}

if (chrome.action && chrome.action.onClicked) {
  chrome.action.onClicked.addListener((tab) => {
    if (chrome.sidePanel && typeof chrome.sidePanel.open === "function" && tab && tab.id) {
      chrome.sidePanel.open({ tabId: tab.id }).catch(() => {});
    }
  });
}

function canAccessTab(url) {
  if (!url) return false;
  return !url.startsWith("chrome://") && 
         !url.startsWith("chrome-extension://") && 
         !url.startsWith("edge://") && 
         !url.startsWith("about:") && 
         !url.startsWith("devtools://") &&
         !url.startsWith("view-source:");
}

function safeRuntimeSendMessage(msg) {
  try {
    const p = chrome.runtime.sendMessage(msg);
    if (p && typeof p.catch === "function") {
      p.catch(() => {});
    }
  } catch (e) {}
}

// Helper: Ensure content script is injected into active tab if not already present
function ensureContentScriptInjected(tabId, callback) {
  if (!tabId || typeof chrome.scripting === "undefined") {
    if (callback) callback();
    return;
  }

  chrome.tabs.get(tabId, (tab) => {
    if (chrome.runtime.lastError || !tab || !canAccessTab(tab.url)) {
      if (chrome.runtime.lastError) { const _ = chrome.runtime.lastError.message; }
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
    }).catch(() => {
      if (callback) callback();
    });
  });
}

// Tab change & URL change listeners for Zero-Touch Auto-Inspection
chrome.tabs.onActivated.addListener((activeInfo) => {
  safeRuntimeSendMessage({
    action: "ACTIVE_TAB_CHANGED",
    tabId: activeInfo.tabId
  });
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === "complete") {
    safeRuntimeSendMessage({
      action: "ACTIVE_TAB_CHANGED",
      tabId: tabId,
      url: tab ? tab.url : ""
    });
  }
});

// Message Router
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  // 1. Relay detected tracking ID to side panel
  if (message.action === "TRACKING_ID_DETECTED") {
    safeRuntimeSendMessage({
      action: "UPDATE_TRACKING_RECEIPT",
      trackingId: message.trackingId
    });
    return false;
  }

  // 2. Relay dynamic DOM mutation to side panel
  if (message.action === "PAGE_DOM_MUTATED") {
    safeRuntimeSendMessage({
      action: "PAGE_DOM_MUTATED"
    });
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
      if (!tabs || tabs.length === 0 || !canAccessTab(tabs[0].url)) {
        sendResponse({ supported: true, url: tabs && tabs[0] ? tabs[0].url : "" });
        return;
      }
      chrome.tabs.sendMessage(tabs[0].id, { action: "CHECK_PAGE_SUPPORT" }, (res) => {
        if (chrome.runtime.lastError) {
          const _ = chrome.runtime.lastError.message;
          ensureContentScriptInjected(tabs[0].id, () => {
            chrome.tabs.sendMessage(tabs[0].id, { action: "CHECK_PAGE_SUPPORT" }, (retryRes) => {
              if (chrome.runtime.lastError) { const __ = chrome.runtime.lastError.message; }
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
      if (!tabs || tabs.length === 0 || !canAccessTab(tabs[0].url)) {
        sendResponse({ supported: true, hasForm: false, fields: [], url: tabs && tabs[0] ? tabs[0].url : "" });
        return;
      }
      chrome.tabs.sendMessage(tabs[0].id, { action: "INSPECT_PAGE_FORM" }, (res) => {
        if (chrome.runtime.lastError) {
          const _ = chrome.runtime.lastError.message;
          ensureContentScriptInjected(tabs[0].id, () => {
            chrome.tabs.sendMessage(tabs[0].id, { action: "INSPECT_PAGE_FORM" }, (retryRes) => {
              if (chrome.runtime.lastError) { const __ = chrome.runtime.lastError.message; }
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
      if (!tabs || tabs.length === 0 || !canAccessTab(tabs[0].url)) {
        sendResponse({ success: false, error: "NO_ACTIVE_TAB" });
        return;
      }
      chrome.tabs.sendMessage(tabs[0].id, {
        action: "FILL_FIELDS",
        fields: message.fields
      }, (res) => {
        if (chrome.runtime.lastError) {
          const _ = chrome.runtime.lastError.message;
          ensureContentScriptInjected(tabs[0].id, () => {
            chrome.tabs.sendMessage(tabs[0].id, {
              action: "FILL_FIELDS",
              fields: message.fields
            }, (retryRes) => {
              if (chrome.runtime.lastError) { const __ = chrome.runtime.lastError.message; }
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
      if (!tabs || tabs.length === 0 || !canAccessTab(tabs[0].url)) {
        sendResponse({ success: false, error: "NO_ACTIVE_TAB" });
        return;
      }
      chrome.tabs.sendMessage(tabs[0].id, {
        action: "HIGHLIGHT_PAGE_ELEMENT",
        target: message.target || "SUBMIT",
        label: message.label
      }, (res) => {
        if (chrome.runtime.lastError) {
          const _ = chrome.runtime.lastError.message;
          ensureContentScriptInjected(tabs[0].id, () => {
            chrome.tabs.sendMessage(tabs[0].id, {
              action: "HIGHLIGHT_PAGE_ELEMENT",
              target: message.target || "SUBMIT",
              label: message.label
            }, (retryRes) => {
              if (chrome.runtime.lastError) { const __ = chrome.runtime.lastError.message; }
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
      if (!tabs || tabs.length === 0 || !canAccessTab(tabs[0].url)) {
        sendResponse({ success: false, error: "NO_ACTIVE_TAB" });
        return;
      }
      chrome.tabs.sendMessage(tabs[0].id, {
        action: "CLICK_PAGE_ELEMENT",
        target: message.target || "SUBMIT"
      }, (res) => {
        if (chrome.runtime.lastError) { const _ = chrome.runtime.lastError.message; }
        sendResponse(res || { success: true });
      });
    });
    return true;
  }
});
